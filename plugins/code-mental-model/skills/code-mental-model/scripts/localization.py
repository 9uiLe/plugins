"""Localized wording for the presentation layer."""

from __future__ import annotations

from typing import assert_never

from domain import Condition, EdgeKind, RoleCode, SummaryCode

SUMMARY_JA = {SummaryCode.UNKNOWN: "主要オブジェクトと接続を図で確認できます。", SummaryCode.CACHED_RESULT_SKIPS_SIDE_EFFECT: "保存済みの結果があれば外部への副作用を繰り返しません。"}
SUMMARY_EN = {SummaryCode.UNKNOWN: "Explore the main objects and their connections.", SummaryCode.CACHED_RESULT_SKIPS_SIDE_EFFECT: "An existing result skips the external side effect."}
ROLE_JA = {RoleCode.ENTRY: "入口", RoleCode.COORDINATOR: "分岐を決める", RoleCode.STATE_HOLDER: "結果を保持", RoleCode.SIDE_EFFECT_BOUNDARY: "外部副作用", RoleCode.DATA_VALUE: "結果データ", RoleCode.UNKNOWN: "役割未確認"}
ROLE_EN = {RoleCode.ENTRY: "entry", RoleCode.COORDINATOR: "coordinator", RoleCode.STATE_HOLDER: "state holder", RoleCode.SIDE_EFFECT_BOUNDARY: "side-effect boundary", RoleCode.DATA_VALUE: "data value", RoleCode.UNKNOWN: "unconfirmed role"}
UI_JA = {"SKIP": "関係図へ移動", "NAV": "ページ内の移動", "MAP_TITLE": "関係図", "SELECTED_TITLE": "選択した対象", "EVIDENCE_TITLE": "根拠の全体像", "MODE_LABEL": "図の表示", "STRUCTURE_MODE": "構造", "EXECUTION_MODE": "実行順", "CHANGE_MODE": "変更", "STRUCTURE_QUESTION": "何が存在し、どう繋がるか。", "SCENARIOS": "実行経路", "EXECUTION_HINT": "図の番号を選ぶと、その手順と分岐条件を確認できます。", "STEP_EXPLANATION_LABEL": "選択した手順の説明", "CLOSE_STEP": "説明を閉じる", "MAP_HINT": "線やノードを選ぶと、対応する根拠とコードを確認できます。", "ADDED": "追加", "CHANGED": "変更", "REMOVED": "削除", "UNKNOWN": "未確認", "STATE_SHAPE": "二重枠 = 状態保持", "EXTERNAL_SHAPE": "六角形 = 外部境界", "CODE_DOCK_LABEL": "選択対象の根拠とコード", "OVERVIEW": "全体を見る"}
UI_EN = {"SKIP": "Skip to relationship map", "NAV": "On this page", "MAP_TITLE": "Relationship map", "SELECTED_TITLE": "Selected item", "EVIDENCE_TITLE": "Evidence overview", "MODE_LABEL": "Map view", "STRUCTURE_MODE": "Structure", "EXECUTION_MODE": "Execution", "CHANGE_MODE": "Change", "STRUCTURE_QUESTION": "What exists, and how is it connected?", "SCENARIOS": "Execution paths", "EXECUTION_HINT": "Select a number to see what happens and why this path is taken.", "STEP_EXPLANATION_LABEL": "Selected step explanation", "CLOSE_STEP": "Close explanation", "MAP_HINT": "Select a node or connection to inspect its evidence and code.", "ADDED": "Added", "CHANGED": "Changed", "REMOVED": "Removed", "UNKNOWN": "Unknown", "STATE_SHAPE": "Double border = state owner", "EXTERNAL_SHAPE": "Hexagon = external boundary", "CODE_DOCK_LABEL": "Evidence and code for the selected item", "OVERVIEW": "Show overview"}


def scenario_text(name: str, locale: str) -> str:
    if locale == "ja-JP":
        return {"first": "初回", "repeat": "再要求"}.get(name, name)
    return name


def execution_step_title(number: int, source: str, target: str, locale: str) -> str:
    return (f"手順 {number} · {source} → {target}" if locale == "ja-JP"
            else f"Step {number} · {source} → {target}")


def execution_condition_text(condition: Condition, summary: SummaryCode,
                             lookup: tuple[str, str] | None, locale: str) -> str:
    if condition == Condition.ALWAYS:
        return ""
    if condition == Condition.UNKNOWN:
        return ""
    if lookup is not None:
        target, operation = lookup
        subject = f"{target} の {operation}" if locale == "ja-JP" else f"{target}.{operation}"
    elif summary == SummaryCode.CACHED_RESULT_SKIPS_SIDE_EFFECT:
        subject = "保存済み結果の検索" if locale == "ja-JP" else "the saved-result lookup"
    else:
        subject = "前の検索" if locale == "ja-JP" else "the preceding lookup"
    if condition == Condition.ON_HIT:
        return (f"{subject} で結果が見つかった場合に進む経路です。" if locale == "ja-JP"
                else f"This path runs when {subject} finds a result.")
    if condition == Condition.ON_MISS:
        return (f"{subject} で結果が見つからなかった場合に進む経路です。miss は検索結果を指し、この手順の失敗ではありません。"
                if locale == "ja-JP" else
                f"This path runs when {subject} finds no result. Miss describes the lookup, not a failure of this step.")
    assert_never(condition)


def graph_description(locale: str) -> str:
    return "オブジェクトと接続。ノードや線を選ぶと対応するコードが開きます。" if locale == "ja-JP" else "Objects and connections. Select a node or line to see its code."


def role_text(role: RoleCode, locale: str) -> str:
    return (ROLE_JA if locale == "ja-JP" else ROLE_EN)[role]


def summary_text(code: SummaryCode, locale: str) -> str:
    return (SUMMARY_JA if locale == "ja-JP" else SUMMARY_EN)[code]


def edge_sentence(kind: EdgeKind, source: str, target: str, label: str, locale: str) -> str:
    if locale != "ja-JP":
        return f"{source} {kind.value} {target} using {label}."
    match kind:
        case EdgeKind.CALLS:
            return f"{source} は {label} を使って {target} を呼び出します。"
        case EdgeKind.READS:
            return f"{source} は {label} を使って {target} を参照します。"
        case EdgeKind.WRITES:
            return f"{source} は {label} を使って {target} を書き込みます。"
        case EdgeKind.RETURNS:
            return f"{source} は {label} を {target} に返します。"
        case EdgeKind.CREATES:
            return f"{source} は {label} として {target} を生成します。"
        case EdgeKind.OWNS:
            return f"{source} は {target} を保持します（{label}）。"
        case EdgeKind.DEPENDS_ON:
            return f"{source} は {target} に依存します（{label}）。"
        case EdgeKind.IMPLEMENTS:
            return f"{source} は {target} を実装します（{label}）。"
        case EdgeKind.EMITS:
            return f"{source} は {label} を {target} に発行します。"
        case EdgeKind.OBSERVES:
            return f"{source} は {target} の {label} を監視します。"
        case EdgeKind.TRANSFORMS:
            return f"{source} は {target} を {label} に変換します。"
        case EdgeKind.PERSISTS:
            return f"{source} は {target} を永続化します（{label}）。"
        case EdgeKind.FETCHES:
            return f"{source} は {target} から {label} を取得します。"
        case EdgeKind.INJECTS:
            return f"{source} は {target} に {label} を注入します。"
        case EdgeKind.DELEGATES_TO:
            return f"{source} は {label} を {target} に委譲します。"
        case _:
            assert_never(kind)
