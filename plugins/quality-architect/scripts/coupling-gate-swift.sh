#!/usr/bin/env bash
# coupling-gate-swift.sh — 結合の深掘り (07a 補論) シグナル計測器（Swift）【EXPERIMENTAL / Phase 2】
#
# ⚠️ EXPERIMENTAL: 本スクリプトは Phase 2 試作の experimental layer。出力は verdict 確定権を
#    持たず、既存 quality-gate-swift.sh の PASS/FAIL を上書きしない。寄与できるのは severity の
#    下方修正のみ（07a §9 H9）。考察パートの所見 attach に閉じる（07a-review-integration.md）。
#
# 目的: Khononov 2024 の 3 次元モデル (Integration Strength × Distance × Volatility)
#       を量子化された SIGNAL として算出し、`coupling-gate-result.json` に出力する。
#       本スクリプトは「Strength ラダー段の確定」を行わない。それは 07a §6.5 hint table が
#       "候補" を出すのみで、段の確定は人手レビューに委譲される（07a §9 H3 規律）。
#
# 設計原則:
#   - `quality-gates.yml` の swift.planned-deterministic.coupling: 各 id 1:1 対応。
#   - ツール未導入は skipped（数値捏造禁止）。exit 2 を返す（quality-gate-swift.sh の inconclusive=2 と同じ規約。fail=1 と区別）。
#   - 観測ウィンドウ依存のシグナル（volatility）は --since=<window> を JSON にも本文にも記録（H5）。
#   - intrusive_hits > 0 は BALANCE 判定の常時 override 句となるため、特別に flag を立てる。
#   - aggregate スコアは概観目的のみ。verdict 根拠としては JSON 内の `note` に Khononov の
#     count-based 否定姿勢を明記し誤用を防ぐ（H2）。
#
# 使い方:
#   ./coupling-gate-swift.sh                   # all signals + aggregate
#   ./coupling-gate-swift.sh --signal distance
#   ./coupling-gate-swift.sh --signal volatility --since=6.months
#   ./coupling-gate-swift.sh --signal intrusive
#   ./coupling-gate-swift.sh --signal shared-model
#   ./coupling-gate-swift.sh --signal cross-boundary-duplicates
#   ./coupling-gate-swift.sh --aggregate balance
#
# 環境変数:
#   CGS_TARGET                対象パス（既定: .）
#   CGS_MODULE_UNIT           module 単位（既定: spm-target）
#   CGS_VOLATILITY_WINDOW     観測ウィンドウ（既定: 6.months）
#
# 出力:
#   coupling-gate-result.json — 全シグナルのフラットな配列（H4/H5 ラベル付き）
#
# 注: 本スクリプトは Phase 2 試作。pinned コマンドの固定・パーサーの安定化・しきい値の
#     根拠調査が完了した時点で、quality-gates.yml の項目を planned-deterministic から
#     deterministic に昇格できる（静的評価 §3.6.4）。

set -uo pipefail

TARGET="${CGS_TARGET:-.}"
MODULE_UNIT="${CGS_MODULE_UNIT:-spm-target}"
VOLATILITY_WINDOW="${CGS_VOLATILITY_WINDOW:-6.months}"
SIGNAL=""
AGGREGATE=""
RESULT_JSON="coupling-gate-result.json"

# --- 引数解析 ---
while [ $# -gt 0 ]; do
  case "$1" in
    --signal) SIGNAL="$2"; shift 2;;
    --signal=*) SIGNAL="${1#*=}"; shift;;
    --aggregate) AGGREGATE="$2"; shift 2;;
    --aggregate=*) AGGREGATE="${1#*=}"; shift;;
    --since=*) VOLATILITY_WINDOW="${1#*=}"; shift;;
    --target=*) TARGET="${1#*=}"; shift;;
    --module-unit=*) MODULE_UNIT="${1#*=}"; shift;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0;;
    *) shift;;
  esac
done

declare -a ROWS=()
ANY_RAN=0
ANY_SKIPPED=0
INTRUSIVE_HITS=0
MEASURED_LIST=""          # measured 済み signal id の空白区切りリスト（bash 3.2 互換）

have() { command -v "$1" >/dev/null 2>&1; }

# is_measured <signal-id> — その signal が measured 済みなら 0 を返す
is_measured() { case " $MEASURED_LIST " in *" $1 "*) return 0;; *) return 1;; esac; }

# record <signal> <tool> <status:measured|skipped|error> <value> <unit> <band_label> <severity> <note>
record() {
  local sig="$1" tool="$2" status="$3" value="$4" unit="$5" band="$6" severity="$7" note="${8:-}"
  case "$status" in
    measured) ANY_RAN=1; MEASURED_LIST="$MEASURED_LIST $sig" ;;
    skipped|error) ANY_SKIPPED=1 ;;
  esac
  ROWS+=("$(printf '{"signal":"%s","tool":"%s","status":"%s","value":"%s","unit":"%s","band":"%s","severity":"%s","module_unit":"%s","observation_window":"%s","note":"%s"}' \
    "$sig" "$tool" "$status" "$value" "$unit" "$band" "$severity" "$MODULE_UNIT" "$VOLATILITY_WINDOW" "$note")")
  printf '  [%-8s] %-30s value=%-12s band=%-15s severity=%-8s %s\n' "$status" "$sig ($tool)" "$value" "$band" "$severity" "$note"
}

# 各 SIGNAL を band map に従って分類するヘルパ
band_classify() {
  # $1: value (integer), $2: signal id
  local v="$1" sig="$2" b="" s=""
  case "$sig" in
    distance-level)
      if [ "$v" -le 1 ]; then b="intra-method"; s="info"
      elif [ "$v" -le 2 ]; then b="intra-object"; s="info"
      elif [ "$v" -le 3 ]; then b="intra-namespace"; s="info"
      elif [ "$v" -le 4 ]; then b="cross-service"; s="medium"
      else b="cross-system"; s="high"
      fi;;
    volatility-proxy)
      if [ "$v" -le 5 ]; then b="stable"; s="info"
      elif [ "$v" -le 20 ]; then b="moderate"; s="info"
      elif [ "$v" -le 100 ]; then b="volatile"; s="medium"
      else b="hot-spot"; s="high"
      fi;;
    intrusive-hits)
      if [ "$v" -le 0 ]; then b="clean"; s="info"
      elif [ "$v" -le 5 ]; then b="watch"; s="high"
      else b="intrusive"; s="critical"
      fi;;
    cross-boundary-duplicates)
      if [ "$v" -le 0 ]; then b="none"; s="info"
      elif [ "$v" -le 3 ]; then b="watch"; s="medium"
      else b="functional"; s="high"
      fi;;
    shared-model-surface)
      if [ "$v" -le 0 ]; then b="contract-only"; s="info"
      elif [ "$v" -le 10 ]; then b="model-low"; s="info"
      else b="model-heavy"; s="medium"
      fi;;
    *) b="unknown"; s="info";;
  esac
  echo "$b $s"
}

# ============================================================
# SIGNAL 1: distance-level
# Khononov Distance (07a §4)。SPM target グラフを `swift package describe` で抽出し、
# モジュール対の境界深さを measure する（試作: 平均距離を返す）。
# ============================================================
run_distance() {
  if ! have swift || ! have jq; then
    record "distance-level" "swift package describe" "skipped" "-" "level" "-" "-" "swift/jq 未インストール (H4 fallback 必要)"
    return
  fi
  if [ "$MODULE_UNIT" != "spm-target" ]; then
    record "distance-level" "swift package describe" "skipped" "-" "level" "-" "-" \
      "module_unit=$MODULE_UNIT は path-depth fallback。distance basis: path-depth fallback を併記すること (H4)"
    return
  fi
  if [ ! -f "$TARGET/Package.swift" ]; then
    record "distance-level" "swift package describe" "skipped" "-" "level" "-" "-" "Package.swift 未検出 (H4 fallback: distance basis: path-depth)"
    return
  fi
  local DESC TARGET_COUNT
  DESC=$(cd "$TARGET" && swift package describe --type json 2>/dev/null || echo '{}')
  TARGET_COUNT=$(echo "$DESC" | jq '(.targets // []) | length' 2>/dev/null || echo 0)
  if [ "${TARGET_COUNT:-0}" -eq 0 ]; then
    record "distance-level" "swift package describe" "skipped" "-" "level" "-" "-" "Package.swift 解析失敗 / targets 0"
    return
  fi
  # 対ごとの境界深さを算出 (07a §4 / LCA)。
  #   target → target (同一パッケージ内の依存): LCA = パッケージ ⇒ distance 3 (Namespaces/Packages)
  #   target → product (外部パッケージ依存):     LCA = サービス境界 ⇒ distance 4 ((Micro)Services)
  # Khononov は count-based 平均を否定 (H2) するため、平均ではなく最遠 (worst-case) 段を採る。
  # 依存フィールドはツール版により target_dependencies / module_dependencies のいずれか。
  local INTRA_EDGES CROSS_EDGES MAX_DIST EDGE_BREAKDOWN
  INTRA_EDGES=$(echo "$DESC" | jq '[.targets[]? | ((.target_dependencies // .module_dependencies // [])[]?)] | length' 2>/dev/null || echo 0)
  CROSS_EDGES=$(echo "$DESC" | jq '[.targets[]? | ((.product_dependencies // [])[]?)] | length' 2>/dev/null || echo 0)
  INTRA_EDGES="${INTRA_EDGES:-0}"; CROSS_EDGES="${CROSS_EDGES:-0}"
  if [ "$CROSS_EDGES" -gt 0 ]; then
    MAX_DIST=4   # 外部 product 依存が最遠
  elif [ "$INTRA_EDGES" -gt 0 ]; then
    MAX_DIST=3   # 同一パッケージ内 target 間依存
  else
    MAX_DIST=2   # target 間依存なし（疎結合）。単一モジュール内 objects 相当
  fi
  # 対ごとの内訳を生成（H3: どの対が境界を跨ぐかを併記）。最大 6 対まで note に列挙。
  EDGE_BREAKDOWN=$(echo "$DESC" | jq -r '
    [ (.targets[]? | .name as $f
        | ((.target_dependencies // .module_dependencies // [])[]? | "\($f)->\(.)=d3"),
          ((.product_dependencies // [])[]? | "\($f)=>\(.)=d4") ) ]
    | (.[0:6] | join(", ")) + (if length > 6 then " …(+\(length-6))" else "" end)' 2>/dev/null || echo "")
  [ -z "$EDGE_BREAKDOWN" ] && EDGE_BREAKDOWN="no inter-target edges (decoupled)"
  read -r BAND SEV < <(band_classify "$MAX_DIST" "distance-level")
  record "distance-level" "swift package describe" "measured" "$MAX_DIST" "level" "$BAND" "$SEV" \
    "${TARGET_COUNT} targets, intra-edges=${INTRA_EDGES}, cross-edges=${CROSS_EDGES}; worst-case 段 (平均不可 H2); module_unit=$MODULE_UNIT; pairs: ${EDGE_BREAKDOWN}"
}

# ============================================================
# SIGNAL 2: volatility-proxy
# observed_change_frequency。--since=<window> は本文にも JSON にも記録（H5）。
# ============================================================
run_volatility() {
  if ! have git; then
    record "volatility-proxy" "git log" "skipped" "-" "commits" "-" "-" "git 未インストール"
    return
  fi
  if ! git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
    record "volatility-proxy" "git log" "skipped" "-" "commits" "-" "-" "git リポジトリではない"
    return
  fi
  local COUNT
  COUNT=$(git -C "$TARGET" log --since="$VOLATILITY_WINDOW" --oneline 2>/dev/null | wc -l | tr -d ' ')
  COUNT="${COUNT:-0}"
  read -r BAND SEV < <(band_classify "$COUNT" "volatility-proxy")
  record "volatility-proxy" "git log" "measured" "$COUNT" "commits" "$BAND" "$SEV" \
    "observation_window=--since=$VOLATILITY_WINDOW (H5 規律により BALANCE 適用時 推測 ラベル必須)"
}

# ============================================================
# SIGNAL 3: intrusive-hits
# モジュール境界を越える private/internal シンボル参照。試作: Semgrep があれば利用、なければ
# パターン検索のみ（Swift access level `private`/`fileprivate`/`internal` 露出パターン）。
# ============================================================
run_intrusive() {
  local HITS=0 TOOL="" SHARED_ELEMENTS=""
  if have semgrep; then
    TOOL="semgrep"
    # experimental: 公式 Swift ruleset がない場合は 0 件返す（捏造禁止）
    HITS=$(semgrep --config p/swift --json "$TARGET" 2>/dev/null | jq '.results | length' 2>/dev/null || echo 0)
    HITS="${HITS:-0}"
    SHARED_ELEMENTS="semgrep p/swift (experimental); カスタム ruleset / SWAN (Tiganov 2020) で精密化余地あり"
  elif have rg; then
    TOOL="ripgrep-pattern"
    # `@testable import` は internal シンボルを境界を越えて露出させる Swift 唯一の静的 intrusive 経路。
    # ただし Tests/ 配下の @testable は正当（テスト目的）。本番ソース側の @testable のみを intrusive と数える。
    # 件数はファイル数ではなく出現回数で数える（旧版はファイル数を数えていた）。
    local MATCHES
    MATCHES=$(rg -n --no-heading '^\s*@testable\s+import\s+\w+' "$TARGET" \
      -g '*.swift' -g '!**/Tests/**' -g '!*Tests.swift' -g '!*Test.swift' 2>/dev/null)
    if [ -n "$MATCHES" ]; then
      HITS=$(printf '%s\n' "$MATCHES" | grep -c '')
      # H3: shared element (path:line) を最大 5 件併記
      SHARED_ELEMENTS=$(printf '%s\n' "$MATCHES" | head -5 | sed 's/[[:space:]]\+/ /g' | paste -sd '; ' -)
    else
      HITS=0
      SHARED_ELEMENTS="本番ソースに @testable import なし"
    fi
    HITS="${HITS:-0}"
  else
    record "intrusive-hits" "(semgrep|rg)" "skipped" "-" "hits" "-" "-" "semgrep / ripgrep 未インストール"
    return
  fi
  HITS="${HITS:-0}"
  INTRUSIVE_HITS="$HITS"
  read -r BAND SEV < <(band_classify "$HITS" "intrusive-hits")
  local OVERRIDE_NOTE=""
  if [ "$HITS" -gt 0 ]; then
    OVERRIDE_NOTE="intrusive_hits>0 は BALANCE override 句先頭固定 (07a §6.5 hint table)。"
  fi
  record "intrusive-hits" "$TOOL" "measured" "$HITS" "hits" "$BAND" "$SEV" \
    "${OVERRIDE_NOTE}shared elements (H3): ${SHARED_ELEMENTS}"
}

# ============================================================
# SIGNAL 4: cross-boundary-duplicates
# jscpd を利用。Swift 対応は experimental だが言語非依存検出が走る。
# ============================================================
run_duplicates() {
  if ! have jscpd; then
    record "cross-boundary-duplicates" "jscpd" "skipped" "-" "pairs" "-" "-" "jscpd 未インストール"
    return
  fi
  local OUT DUP_COUNT
  OUT=$(jscpd --reporters json --silent "$TARGET" 2>/dev/null || echo '{}')
  DUP_COUNT=$(echo "$OUT" | jq '.statistics.total.clones // 0' 2>/dev/null || echo 0)
  DUP_COUNT="${DUP_COUNT:-0}"
  read -r BAND SEV < <(band_classify "$DUP_COUNT" "cross-boundary-duplicates")
  record "cross-boundary-duplicates" "jscpd" "measured" "$DUP_COUNT" "pairs" "$BAND" "$SEV" \
    "Functional Coupling シグナル。hint table 入力（候補）。重複対の path:line 併記必須 (H3)"
}

# ============================================================
# SIGNAL 5: shared-model-surface
# 公開型 (public/open) が境界を跨いで参照される件数。試作: target 横断 public 型数を概算。
# ============================================================
run_shared_model() {
  if ! have rg; then
    record "shared-model-surface" "ripgrep" "skipped" "-" "types" "-" "-" "ripgrep 未インストール"
    return
  fi

  # 精密版: SPM target 単位で「公開型のうち、他 target が import + 参照しているもの」だけを数える。
  # 単に public 型を総数で数える旧来法では境界跨ぎでない公開型も拾ってしまうため (07a §3 Model Coupling)。
  if have swift && have jq && [ "$MODULE_UNIT" = "spm-target" ] && [ -f "$TARGET/Package.swift" ]; then
    local DESC
    DESC=$(cd "$TARGET" && swift package describe --type json 2>/dev/null || echo '{}')
    local -a TNAMES=() TPATHS=()
    while IFS=$'\t' read -r _n _p; do
      [ -z "$_n" ] && continue
      TNAMES+=("$_n"); TPATHS+=("$_p")
    done < <(echo "$DESC" | jq -r '.targets[]? | [.name, (.path // "")] | @tsv' 2>/dev/null)

    if [ "${#TNAMES[@]}" -ge 2 ]; then
      local CROSS_COUNT=0 EXAMPLES="" ti tj
      for ti in "${!TNAMES[@]}"; do
        local SRC_NAME="${TNAMES[$ti]}" SRC_PATH="${TPATHS[$ti]}"
        [ -z "$SRC_PATH" ] && SRC_PATH="Sources/$SRC_NAME"
        local ABS_SRC="$TARGET/$SRC_PATH"
        [ -d "$ABS_SRC" ] || continue
        # この target が公開している型名（public/open struct|class|protocol|enum）
        local -a PUB_TYPES=()
        while IFS= read -r _t; do [ -n "$_t" ] && PUB_TYPES+=("$_t"); done < <(
          rg --no-filename -o -r '$1' '^\s*(?:public|open)\s+(?:final\s+)?(?:struct|class|protocol|enum)\s+(\w+)' \
            "$ABS_SRC" --glob '*.swift' 2>/dev/null | sort -u)
        [ "${#PUB_TYPES[@]}" -eq 0 ] && continue
        # 他 target のうち、この module を import しているものを走査
        for tj in "${!TNAMES[@]}"; do
          [ "$tj" = "$ti" ] && continue
          local OTHER_PATH="${TPATHS[$tj]}"
          [ -z "$OTHER_PATH" ] && OTHER_PATH="Sources/${TNAMES[$tj]}"
          local ABS_OTHER="$TARGET/$OTHER_PATH"
          [ -d "$ABS_OTHER" ] || continue
          rg -q "^\s*(?:@testable\s+)?import\s+${SRC_NAME}\b" "$ABS_OTHER" --glob '*.swift' 2>/dev/null || continue
          # import している → 公開型のうち実際に参照されているものを数える
          local _type
          for _type in "${PUB_TYPES[@]}"; do
            if rg -q "\b${_type}\b" "$ABS_OTHER" --glob '*.swift' 2>/dev/null; then
              CROSS_COUNT=$((CROSS_COUNT+1))
              [ "$(printf '%s' "$EXAMPLES" | tr -cd ',' | wc -c)" -lt 5 ] && \
                EXAMPLES="${EXAMPLES:+$EXAMPLES, }${SRC_NAME}.${_type}->${TNAMES[$tj]}"
            fi
          done
        done
      done
      read -r BAND SEV < <(band_classify "$CROSS_COUNT" "shared-model-surface")
      record "shared-model-surface" "swift package describe + ripgrep" "measured" "$CROSS_COUNT" "types" "$BAND" "$SEV" \
        "境界跨ぎ参照のみ計上 (Model Coupling, 07a §3)。DTO 専用なら model-low、ドメインロジック付きは 1 件でも model-heavy 扱い (07a §6.5 hint table; 候補)。shared elements (H3): ${EXAMPLES:-none}"
      return
    fi
  fi

  # fallback: module 境界を解決できない場合は公開型総数（境界跨ぎ判定なし）。
  local PUBLIC_TYPES
  PUBLIC_TYPES=$(rg -c '^(public|open) (struct|class|protocol|enum) ' "$TARGET" --glob '*.swift' 2>/dev/null | awk -F: '{ s += $2 } END { print s+0 }')
  PUBLIC_TYPES="${PUBLIC_TYPES:-0}"
  read -r BAND SEV < <(band_classify "$PUBLIC_TYPES" "shared-model-surface")
  record "shared-model-surface" "ripgrep-pattern" "measured" "$PUBLIC_TYPES" "types" "$BAND" "$SEV" \
    "Model Coupling シグナル (境界跨ぎ判定なし fallback: distance basis path-depth)。DTO 専用なら model-low、ドメインロジック付きなら 1 件でも model-heavy (07a §6.5 hint table; 候補)"
}

# ============================================================
# AGGREGATE: balance-pairs-ratio
# 概観目的のみ。verdict 根拠に使わない（H2 / Khononov count-based 否定）。
# 試作: シグナル単位の band severity を集約して boolean 化。
# ============================================================
run_aggregate_balance() {
  # BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY (07a §6.1)。
  # 各次元の core SIGNAL（distance / volatility / intrusive）が measured で揃った時のみ
  # 概観ラベルを出す。一つでも skipped なら inconclusive（skipped を pass と誤読させない）。
  local BALANCE_LABEL STATUS NOTE missing=""
  is_measured distance-level   || missing="$missing distance-level"
  is_measured volatility-proxy || missing="$missing volatility-proxy"
  is_measured intrusive-hits   || missing="$missing intrusive-hits"

  if [ "$ANY_RAN" -eq 0 ]; then
    STATUS="inconclusive"; BALANCE_LABEL="inconclusive (all signals skipped)"
    NOTE="全 SIGNAL skipped。集計不能。skipped を pass と誤読しない (H2 / 試作値)"
  elif [ -n "$missing" ]; then
    STATUS="inconclusive"; BALANCE_LABEL="inconclusive (missing:${missing})"
    NOTE="BALANCE 各次元の core SIGNAL が未計測 (missing:${missing})。集計不能。skipped を pass と誤読しない (H2 / 試作値)"
  elif [ "$INTRUSIVE_HITS" -gt 0 ]; then
    STATUS="measured"; BALANCE_LABEL="false (intrusive override)"
    NOTE="概観目的のみ。verdict 根拠不可 (H2 / Khononov count-based 否定)。試作値"
  else
    STATUS="measured"; BALANCE_LABEL="indicative-true"  # 個別ペア判定ではないことを示す名
    NOTE="概観目的のみ。verdict 根拠不可 (H2 / Khononov count-based 否定)。試作値"
  fi
  ROWS+=("$(printf '{"signal":"balance-pairs-ratio","tool":"aggregate","status":"%s","value":"%s","unit":"label","band":"-","severity":"-","module_unit":"%s","observation_window":"%s","note":"%s"}' \
    "$STATUS" "$BALANCE_LABEL" "$MODULE_UNIT" "$VOLATILITY_WINDOW" "$NOTE")")
  printf '  [%-9s] %-30s value=%-30s note=概観のみ\n' \
    "$STATUS" "balance-pairs-ratio" "$BALANCE_LABEL"
}

echo "== 結合の深掘り (07a 補論) SIGNAL 計測 — Swift =="
echo "target: $TARGET"
echo "module_unit: $MODULE_UNIT"
echo "volatility window: --since=$VOLATILITY_WINDOW"
echo

# --- SIGNAL 実行 ---
case "$SIGNAL" in
  distance) run_distance;;
  volatility) run_volatility;;
  intrusive) run_intrusive;;
  cross-boundary-duplicates|duplicates) run_duplicates;;
  shared-model) run_shared_model;;
  "") run_distance; run_volatility; run_intrusive; run_duplicates; run_shared_model;;
  *)
    echo "未知の --signal: $SIGNAL" >&2
    echo "valid: distance | volatility | intrusive | cross-boundary-duplicates | shared-model" >&2
    exit 64;;
esac

# --- AGGREGATE 実行 ---
case "$AGGREGATE" in
  balance) run_aggregate_balance;;
  "") [ -z "$SIGNAL" ] && run_aggregate_balance;;
  *)
    echo "未知の --aggregate: $AGGREGATE" >&2
    exit 64;;
esac

# --- VERDICT ---
if [ "$ANY_RAN" -eq 0 ]; then
  VERDICT="inconclusive"
elif [ "$INTRUSIVE_HITS" -gt 0 ]; then
  VERDICT="intrusive-override"   # 07a §6.5 hint table の常時 override
else
  VERDICT="signals-collected"   # 注: pass/fail は出さない（07a §3 H3 規律により段の確定は別工程）
fi

# --- 出力 ---
{
  printf '{\n  "model":"Khononov 2024 — 3D coupling",\n'
  printf '  "language":"swift",\n'
  printf '  "module_unit":"%s",\n' "$MODULE_UNIT"
  printf '  "observation_window":"--since=%s",\n' "$VOLATILITY_WINDOW"
  printf '  "verdict":"%s",\n' "$VERDICT"
  printf '  "intrusive_override":%s,\n' "$( [ "$INTRUSIVE_HITS" -gt 0 ] && echo true || echo false )"
  printf '  "ran_any":%s,\n' "$( [ "$ANY_RAN" -eq 1 ] && echo true || echo false )"
  printf '  "skipped_any":%s,\n' "$( [ "$ANY_SKIPPED" -eq 1 ] && echo true || echo false )"
  printf '  "h2_warning":"Pain = Strength × Distance × Volatility は本書 verbatim 存在 (Ch.10 §10.2.1, 邦訳 p.182) だが 2値スケール前提(高=1/低=0) + 正確な科学ではない警告(§10.3 p.184)付き。連続値の精密メトリクスとして使わない。canonical 第一表現は BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY (07a §6.1, 同じく書籍 verbatim)",\n'
  printf '  "h3_warning":"Integration Strength 段の確定は共有要素 (symbol/type/contract path) 併記が必須。本ファイルは SIGNAL のみで段は確定しない",\n'
  printf '  "h9_warning":"既存 07/08 のしきい値・PASS/FAIL を上書きしない。重大度の下方修正のみ可",\n'
  printf '  "signals":[\n'
  for i in "${!ROWS[@]}"; do
  printf '    %s%s\n' "${ROWS[$i]}" "$([ "$i" -lt $((${#ROWS[@]}-1)) ] && echo ,)"
  done
  printf '  ]\n}\n'
} > "$RESULT_JSON"

echo
echo "== verdict: $VERDICT  -> $RESULT_JSON =="
echo "注: skipped はツール未導入。考察パートで人手/LLM 補完が必要。"
echo "注: distance / shared-model は target.dependencies / import 解析で対ごとに算出済み。"
echo "注: 本スクリプトは Phase 2 (planned-deterministic)。deterministic 昇格には pinned コマンド・"
echo "    固定パーサー・閾値根拠の 3 点とユーザ明示同意が必要 (静的評価 §3.6.4)。"

# exit code: 全 skipped なら 2、intrusive_hits>0 なら 1、それ以外は 0
if [ "$ANY_RAN" -eq 0 ]; then
  exit 2
elif [ "$INTRUSIVE_HITS" -gt 0 ]; then
  exit 1
else
  exit 0
fi
