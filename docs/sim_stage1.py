"""PCタイクーン 段階1（自室の机）のシミュレータ（参考資料）。

数値の採用値は Params の既定値＝docs/balance.stage1.json と同じ。
ゲーム本体はこのファイルを使わない。ルールはTypeScriptで作り直し、想定の遊び方（Smart）をテスト用のボットとして移植する。
実行：python3 sim_stage1.py（標準ライブラリのみ）

段階1の流れ:
  ジャンクPCを仕入れる → 分解して部品を取り出す → 部品4個で再生PCを組む → フリマの客に発送して売る
  プレイヤーの手は1つ。3つの作業のどれに手を使うかが「最初の苦労」。
  アルバイトを雇うと、1つの列を代わりに回してくれる。
  下請け（部品支給の組み立て注文）は段階1から受けられる。
  貸し倉庫の初期費用がたまったら段階1クリア。

ゲーム内の時計は無い。時間はすべて実時間の秒。

v1からの変更:
  - 初期資金が雇用費を上回り、開始直後に雇えてしまっていた（対照群が0.05秒で雇用）→ 数値を探索で決め直す
  - クリア額は方針の行動を変えないので、所持金が各しきい値に初めて届いた時刻を記録して事後に選べるようにした
  - 「楽になる」を測る指標（雇用前後の手の忙しさ・収入の伸び・客の取りこぼし）を追加
"""
from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field, replace

CLEAR_STEPS = tuple(range(100_000, 700_001, 50_000))


@dataclass(frozen=True)
class Params:
    start_cash: int = 10_000
    junk_price: int = 3_000
    # ジャンク1台から取れる使える部品の数の分布（当たり外れ）。期待値2.4個
    yield_dist: tuple = ((1, 0.20), (2, 0.35), (3, 0.30), (4, 0.15))
    parts_per_pc: int = 4
    sale_price: int = 19_800
    market_fee_rate: float = 0.10
    shipping_cost: int = 1_500
    # プレイヤーの作業時間（秒）
    t_disassemble: float = 2.5
    t_assemble: float = 4.0
    t_ship: float = 1.5
    # フリマの客
    buyer_interval: float = 7.0      # 最初の注文の平均間隔（秒）
    rep_gain: float = 0.02           # 1台売るごとの客の増え方
    rep_cap: float = 2.0             # 段階1での客の増え方の上限（倍）
    buyer_patience: float = 15.0     # 注文が待ってくれる秒数（過ぎるとほかの出品者から買われる）
    # 支払い（次の支払いまであと◯秒、と表示する）
    pay_interval: float = 60.0
    utility_cost: int = 1_500
    pay_grace: float = 30.0          # 払えなかったときの猶予（あと◯秒で倒産、と表示する）
    # アルバイト
    hire_cost: int = 60_000
    wage: int = 12_000
    worker_eff: float = 0.9
    max_workers: int = 2
    # 下請け
    sub_first: float = 45.0
    sub_every: float = 75.0
    sub_units: int = 6
    sub_deadline: float = 90.0
    sub_fee: int = 4_000
    sub_penalty_per_unit: int = 4_000
    # 段階1クリア（貸し倉庫の初期費用）
    clear_cost: int = 400_000
    horizon: float = 900.0
    dt: float = 0.1


LANES = ("dis", "asm", "ship")


@dataclass
class Sub:
    kits: int
    left: int
    deadline: float
    fee: int
    penalty: int


@dataclass
class State:
    p: Params
    rng: random.Random
    t: float = 0.0
    cash: float = 0.0
    junk: int = 0
    parts: int = 0
    pcs: int = 0
    sales: int = 0
    buyers: list = field(default_factory=list)
    next_buyer: float = 0.0
    next_pay: float = 0.0
    next_sub: float = 0.0
    sub: Sub | None = None
    sub_done_ok: int = 0
    sub_failed: int = 0
    player_task: list | None = None
    workers: list = field(default_factory=list)
    # 記録
    busy_log: list = field(default_factory=list)     # 0.1秒ごとのプレイヤーの手の状態
    income_log: list = field(default_factory=list)   # (時刻, 入金額)
    arrive_times: list = field(default_factory=list)
    lost_times: list = field(default_factory=list)
    sale_times: list = field(default_factory=list)
    asm_times: list = field(default_factory=list)
    hire_times: list = field(default_factory=list)
    reach: dict = field(default_factory=dict)        # しきい値 → 初めて届いた時刻
    min_cash: float = 1e18
    bankrupt: bool = False
    pile_log: list = field(default_factory=list)
    task_log: list = field(default_factory=list)     # (時刻, 1=自分の手 / 0=アルバイト)
    penalties: int = 0
    debt_deadline: float | None = None
    grace_count: int = 0


def draw_yield(s: State) -> int:
    r = s.rng.random()
    acc = 0.0
    for n, pr in s.p.yield_dist:
        acc += pr
        if r < acc:
            return n
    return s.p.yield_dist[-1][0]


def buyer_rate(s: State) -> float:
    mult = min(s.p.rep_cap, 1.0 + s.p.rep_gain * s.sales)
    return mult / s.p.buyer_interval


def task_time(s: State, lane: str, eff: float) -> float:
    base = {"dis": s.p.t_disassemble, "asm": s.p.t_assemble, "ship": s.p.t_ship}[lane]
    return base / eff


def can_do(s: State, lane: str, is_sub: bool = False) -> bool:
    if lane == "dis":
        return s.junk > 0
    if lane == "asm":
        if is_sub:
            return s.sub is not None and s.sub.kits > 0
        return s.parts >= s.p.parts_per_pc
    if lane == "ship":
        return s.pcs > 0 and len(s.buyers) > 0
    return False


def begin(s: State, lane: str, is_sub: bool = False):
    """作業を始めるときに材料を取る（途中で他の手に取られないように）。"""
    if lane == "dis":
        s.junk -= 1
    elif lane == "asm":
        if is_sub:
            s.sub.kits -= 1
        else:
            s.parts -= s.p.parts_per_pc
    elif lane == "ship":
        s.pcs -= 1
        s.buyers.pop(0)


def earn(s: State, amount: float):
    s.cash += amount
    s.income_log.append((s.t, amount))


def finish(s: State, lane: str, is_sub: bool = False):
    if lane == "dis":
        s.parts += draw_yield(s)
    elif lane == "asm":
        if is_sub:
            if s.sub is not None:
                s.sub.left -= 1
                earn(s, s.sub.fee)
                if s.sub.left <= 0:
                    s.sub_done_ok += 1
                    s.sub = None
        else:
            s.pcs += 1
            s.asm_times.append(s.t)
    elif lane == "ship":
        earn(s, s.p.sale_price * (1 - s.p.market_fee_rate) - s.p.shipping_cost)
        s.sales += 1
        s.sale_times.append(s.t)


# ---------------------------------------------------------------- 方針（プレイヤーの遊びかた）

class Policy:
    name = "base"
    use_sub = False

    def choose(self, s: State):
        raise NotImplementedError

    def buy(self, s: State):
        pass

    def hire(self, s: State):
        pass

    def accept_sub(self, s: State) -> bool:
        return self.use_sub


class Smart(Policy):
    """詰まりを見て手を動かす人（想定の遊びかた）。
    発送を最優先し、部品がたまれば組み、足りなければ分解する。下請けは締め切りが迫れば優先する。
    雇用は、雇用費＋給料1回分が手元にあれば行う。"""
    name = "smart"

    def __init__(self, use_sub=True, junk_buffer=2, reserve_wages=1):
        self.use_sub = use_sub
        self.junk_buffer = junk_buffer
        self.reserve_wages = reserve_wages

    def choose(self, s: State):
        wl = [w[0] for w in s.workers]
        if can_do(s, "ship"):
            return ("ship", False)
        if s.sub is not None and s.sub.kits > 0 and (
                s.sub.deadline - s.t) < s.sub.kits * s.p.t_assemble * 1.6:
            return ("asm", True)
        stock_high = s.pcs >= 3
        if not stock_high and can_do(s, "asm") and "asm" not in wl:
            return ("asm", False)
        if s.sub is not None and s.sub.kits > 0 and ("asm" in wl or stock_high or not can_do(s, "asm")):
            if "asm" not in wl or stock_high:
                return ("asm", True)
        if not stock_high and can_do(s, "dis") and "dis" not in wl and s.parts < s.p.parts_per_pc * 2:
            return ("dis", False)
        if can_do(s, "asm") and not stock_high:
            return ("asm", False)
        if can_do(s, "dis") and s.parts < s.p.parts_per_pc * 3 and not stock_high:
            return ("dis", False)
        if s.sub is not None and s.sub.kits > 0:
            return ("asm", True)
        return None

    def reserve(self, s: State):
        return len(s.workers) * s.p.wage + s.p.utility_cost

    def buy(self, s: State):
        need = self.junk_buffer
        if s.pcs >= 3 or s.parts >= s.p.parts_per_pc * 3:
            need = 0
        while s.junk < need and s.cash - s.p.junk_price >= self.reserve(s):
            s.cash -= s.p.junk_price
            s.junk += 1
        # 手元に作る材料が何もないときは、給料の取り置きを崩してでも仕入れる
        # （v2初版はここで行き詰まり、下請けなしの想定プレイが17.5%倒産していた＝方針の不具合）
        if s.junk == 0 and s.parts < s.p.parts_per_pc and s.pcs == 0 and s.cash >= s.p.junk_price:
            s.cash -= s.p.junk_price
            s.junk += 1

    def hire(self, s: State):
        if len(s.workers) >= s.p.max_workers:
            return
        # 雇ったあとの次の支払い額と、ジャンク1台分を残せるときだけ雇う
        # （v2初版は電気代を見落とし、支払い直前に雇って想定プレイが5〜9%倒産していた＝方針の不具合）
        next_bill = s.p.utility_cost + s.p.wage * (len(s.workers) + 1)
        cost = s.p.hire_cost + self.reserve_wages * next_bill + s.p.junk_price
        if s.cash < cost:
            return
        if len(s.workers) == 1:
            # 2人目は、生産が需要に追いついていないときだけ
            recent = [x for x in s.asm_times if x > s.t - 30]
            if len(recent) / 30.0 >= buyer_rate(s) * 0.95:
                return
        wl = [w[0] for w in s.workers]
        lane = "asm" if "asm" not in wl else "dis"
        s.cash -= s.p.hire_cost
        s.workers.append([lane, None, False])
        s.hire_times.append(s.t)


class Rotation(Policy):
    """対照群：状況を見ない。分解→組立→発送を順番に回し、仕入れは切れたら5台まとめ買い、
    雇えるならすぐ雇う（分解担当から）。"""
    name = "rotation"

    def __init__(self, use_sub=True):
        self.i = 0
        self.use_sub = use_sub

    def choose(self, s: State):
        for k in range(3):
            lane = LANES[(self.i + k) % 3]
            if lane == "asm" and s.sub is not None and s.sub.kits > 0 and not can_do(s, "asm"):
                self.i = (self.i + k + 1) % 3
                return ("asm", True)
            if can_do(s, lane):
                self.i = (self.i + k + 1) % 3
                return (lane, False)
        return None

    def buy(self, s: State):
        if s.junk == 0:
            n = 5
            while n > 0 and s.cash >= s.p.junk_price:
                s.cash -= s.p.junk_price
                s.junk += 1
                n -= 1

    def hire(self, s: State):
        if len(s.workers) < s.p.max_workers and s.cash >= s.p.hire_cost:
            lane = ["dis", "ship"][len(s.workers) % 2]
            s.cash -= s.p.hire_cost
            s.workers.append([lane, None, False])
            s.hire_times.append(s.t)


class Reckless(Smart):
    """無謀：手元の現金をすべてジャンクに替える（在庫に現金を寝かせる）。"""
    name = "reckless"

    def buy(self, s: State):
        while s.cash >= s.p.junk_price and s.junk < 40:
            s.cash -= s.p.junk_price
            s.junk += 1

    def reserve(self, s):
        return 0


# ---------------------------------------------------------------- 実行

def run(p: Params, policy: Policy, seed: int) -> State:
    s = State(p=p, rng=random.Random(seed))
    s.cash = p.start_cash
    s.next_buyer = s.rng.expovariate(buyer_rate(s))
    s.next_pay = p.pay_interval
    s.next_sub = p.sub_first
    steps = int(round(p.horizon / p.dt))
    pending = list(CLEAR_STEPS)
    for step in range(1, steps + 1):
        s.t = step * p.dt
        while s.t >= s.next_buyer:
            s.buyers.append(s.next_buyer)
            s.arrive_times.append(s.next_buyer)
            s.next_buyer += s.rng.expovariate(buyer_rate(s))
        while s.buyers and s.t - s.buyers[0] > p.buyer_patience:
            s.buyers.pop(0)
            s.lost_times.append(s.t)
        if s.t >= s.next_sub:
            s.next_sub += p.sub_every
            if s.sub is None and policy.accept_sub(s):
                s.sub = Sub(kits=p.sub_units, left=p.sub_units, deadline=s.t + p.sub_deadline,
                            fee=p.sub_fee, penalty=p.sub_penalty_per_unit)
        if s.sub is not None and s.t >= s.sub.deadline:
            pen = s.sub.left * s.sub.penalty
            s.cash -= pen
            s.penalties += pen
            s.sub_failed += 1
            s.sub = None
        if s.t >= s.next_pay:
            s.next_pay += p.pay_interval
            s.cash -= p.utility_cost + p.wage * len(s.workers)
            if s.cash < 0 and s.debt_deadline is None:
                # 払えなければ猶予に入る（銀行からの借り入れは無し）
                s.debt_deadline = s.t + p.pay_grace
                s.grace_count += 1
        if s.debt_deadline is not None:
            if s.cash >= 0:
                s.debt_deadline = None
            elif s.t >= s.debt_deadline:
                s.bankrupt = True
                break
        policy.buy(s)
        policy.hire(s)
        if s.player_task is None:
            c = policy.choose(s)
            if c is not None and can_do(s, c[0], c[1]):
                begin(s, c[0], c[1])
                s.player_task = [c[0], task_time(s, c[0], 1.0), c[1]]
        busy = s.player_task is not None
        if s.player_task is not None:
            s.player_task[1] -= p.dt
            if s.player_task[1] <= 1e-9:
                finish(s, s.player_task[0], s.player_task[2])
                s.task_log.append((s.t, 1))
                s.player_task = None
        for w in s.workers:
            if w[1] is None:
                use_sub = w[0] == "asm" and not can_do(s, "asm") and s.sub is not None and s.sub.kits > 0
                if can_do(s, w[0], use_sub):
                    begin(s, w[0], use_sub)
                    w[1] = task_time(s, w[0], p.worker_eff)
                    w[2] = use_sub
            if w[1] is not None:
                w[1] -= p.dt
                if w[1] <= 1e-9:
                    finish(s, w[0], w[2])
                    s.task_log.append((s.t, 0))
                    w[1] = None
        s.busy_log.append(1 if busy else 0)
        if step % 5 == 0:
            s.pile_log.append((s.t, s.junk, s.parts, s.pcs, len(s.buyers)))
        s.min_cash = min(s.min_cash, s.cash)
        while pending and s.cash >= pending[0]:
            s.reach[pending.pop(0)] = s.t
        if not pending:
            break
    return s


def pile_top(s: State, junk, parts, pcs, buyers):
    """ふだんの量を超えてたまっている山のうち、一番大きいもの。
    （初版はジャンクの買い置き2台を「詰まり」と数えてしまい、ほぼ常にジャンクが一番になっていた）"""
    piles = {
        "junk": junk - 2,                            # 買い置き2台はふだんの量
        "parts": (parts - s.p.parts_per_pc) / s.p.parts_per_pc,   # 1台分はふだんの量
        "pcs": pcs - 1,
        "buyers": buyers - 1,
    }
    top = max(piles, key=piles.get)
    return top if piles[top] >= 1.0 else None


def bottleneck_shifts(s: State, t0: float, t1: float, hold: float = 6.0) -> int:
    """画面で一番大きく見える山（詰まり）が、hold秒以上続いて別の場所に移った回数。"""
    shifts = 0
    cur, since, confirmed = None, 0.0, None
    for (t, junk, parts, pcs, buyers) in s.pile_log:
        if t < t0 or t > t1:
            continue
        top = pile_top(s, junk, parts, pcs, buyers)
        if top != cur:
            cur, since = top, t
        if cur is not None and cur != confirmed and t - since >= hold:
            if confirmed is not None:
                shifts += 1
            confirmed = cur
    return shifts


def window_mean(log, dt, t0, t1):
    a, b = int(max(0, t0) / dt), int(max(0, t1) / dt)
    seg = log[a:b]
    return statistics.mean(seg) if seg else math.nan


def income_rate(s: State, t0: float, t1: float):
    t0 = max(0.0, t0)
    if t1 <= t0:
        return math.nan
    return sum(a for t, a in s.income_log if t0 <= t < t1) / (t1 - t0)


def metrics(s: State) -> dict:
    p = s.p
    first_sale = s.sale_times[0] if s.sale_times else math.inf
    h = s.hire_times[0] if s.hire_times else math.inf
    m = {
        "first_sale": first_sale,
        "first_hire": h,
        "second_hire": s.hire_times[1] if len(s.hire_times) > 1 else math.inf,
        "min_cash": s.min_cash,
        "bankrupt": s.bankrupt,
        "sub_ok": s.sub_done_ok,
        "sub_fail": s.sub_failed,
    }
    if math.isfinite(h):
        m["busy_pre"] = window_mean(s.busy_log, p.dt, 0, h)
        m["busy_post"] = window_mean(s.busy_log, p.dt, h + 5, h + 65)
        # 雇用直前30秒と、雇用後5〜65秒の1秒あたり収入
        pre = income_rate(s, h - 30, h)
        post = income_rate(s, h + 5, h + 65)
        m["income_jump"] = post / pre if pre and pre > 0 else math.nan
        arr_pre = len([t for t in s.arrive_times if t < h])
        m["lost_pre"] = len([t for t in s.lost_times if t < h]) / arr_pre if arr_pre else 0.0
        arr_post = len([t for t in s.arrive_times if h <= t < h + 120])
        m["lost_post"] = len([t for t in s.lost_times if h <= t < h + 120]) / arr_post if arr_post else 0.0
        m["shifts_pre"] = bottleneck_shifts(s, 0, h)
        m["desk_peak_pre"] = max([j + pa + pc for (t, j, pa, pc, b) in s.pile_log if t < h] or [0])
        post_tasks = [who for (t, who) in s.task_log if h + 5 <= t < h + 65]
        m["hand_share_post"] = sum(post_tasks) / len(post_tasks) if post_tasks else math.nan
    else:
        for k in ("busy_pre", "busy_post", "income_jump", "lost_pre", "lost_post", "shifts_pre",
                  "desk_peak_pre", "hand_share_post"):
            m[k] = math.nan
    for c in CLEAR_STEPS:
        m[f"reach_{c}"] = s.reach.get(c, math.inf)
        # 段階1を通して、詰まりの場所が移った回数（クリア額ごと）
        m[f"shifts_{c}"] = bottleneck_shifts(s, 0, s.reach.get(c, s.t))
    m["grace_count"] = s.grace_count
    return m


def med(rows, k):
    vals = sorted(r[k] for r in rows if not (isinstance(r[k], float) and math.isnan(r[k])))
    if not vals:
        return math.nan
    return vals[len(vals) // 2]


def pct(rows, k, q):
    vals = sorted(r[k] for r in rows if not (isinstance(r[k], float) and math.isnan(r[k])))
    if not vals:
        return math.nan
    return vals[min(len(vals) - 1, int(q * len(vals)))]


def rate(rows, k):
    return sum(1 for r in rows if r[k]) / len(rows)


POLICIES = {
    "smart": lambda: Smart(),
    "smart_nosub": lambda: Smart(use_sub=False),
    "rotation": lambda: Rotation(),
    "rotation_nosub": lambda: Rotation(use_sub=False),
    "reckless": lambda: Reckless(),
}


def evaluate(p: Params, seeds=range(80), policies=POLICIES):
    return {name: [metrics(run(p, fac(), sd)) for sd in seeds] for name, fac in policies.items()}


if __name__ == "__main__":
    p = Params()
    key = f"reach_{p.clear_cost}"
    res = evaluate(p, seeds=range(100))
    for name, rows in res.items():
        print(name)
        print(f"  初めて売れる {med(rows, 'first_sale'):.1f}秒 / 初めて雇う {med(rows, 'first_hire'):.1f}秒 / "
              f"取りこぼし 雇う前 {med(rows, 'lost_pre'):.0%} → 雇った後 {med(rows, 'lost_post'):.0%} / "
              f"収入の伸び {med(rows, 'income_jump'):.2f}倍 / クリア {med(rows, key):.1f}秒 / 倒産 {rate(rows, 'bankrupt'):.0%}")
