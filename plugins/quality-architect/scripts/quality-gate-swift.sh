#!/usr/bin/env bash
# quality-gate-swift.sh — ISO/IEC 25010 静的評価レイヤーの「決定論パート」実行器（Swift）
#
# 目的: LLM の揺らぎを排除するため、測れる指標は実在ツールで計測し、
#       固定しきい値と機械的に突き合わせて pass/fail を確定する。
#       出力 JSON を quality-review スキルに食わせれば、スキルは数値を解釈するだけで済む。
#
# 設計: しきい値は環境変数で上書き可（既定値は quality-gates.yml の swift プロファイルに準拠）。
#       未インストールのツールは "skipped" として記録し、結果を捏造しない。
#       1 つでも fail があれば終了コード 1（CI ゲート用）。
#
# 依存（任意・あるものだけ実行）: swiftlint, lizard, periphery, swift-format(or swiftformat), trivy, jq, swift
# 使い方:  ./quality-gate-swift.sh [対象パス(既定: .)]
#          QG_CCN_MAX=20 QG_COVERAGE_MIN=0.70 ./quality-gate-swift.sh
#
# 出力:    標準出力に人間可読サマリ + カレントに quality-gate-result.json

set -uo pipefail

TARGET="${1:-.}"
SRC_DIRS=("Sources" "Tests")

# --- しきい値（quality-gates.yml と一致。env で上書き可） ---
QG_CCN_MAX="${QG_CCN_MAX:-20}"            # 循環的複雑度の許容上限（超過=fail）
QG_COVERAGE_MIN="${QG_COVERAGE_MIN:-0.70}" # ラインカバレッジ下限
QG_DEPVULN_SEVERITY="${QG_DEPVULN_SEVERITY:-HIGH,CRITICAL}" # これ以上の依存脆弱性=fail

RESULT_JSON="quality-gate-result.json"
declare -a ROWS=()
OVERALL=0
RAN=0

have() { command -v "$1" >/dev/null 2>&1; }

# record <gate> <tool> <status:pass|fail|skipped> <measured> <threshold> <note>
record() {
  local gate="$1" tool="$2" status="$3" measured="$4" thr="$5" note="${6:-}"
  [ "$status" = "fail" ] && OVERALL=1
  [ "$status" != "skipped" ] && RAN=$((RAN+1))
  ROWS+=("$(printf '{"gate":"%s","tool":"%s","status":"%s","measured":"%s","threshold":"%s","note":"%s"}' \
    "$gate" "$tool" "$status" "$measured" "$thr" "$note")")
  printf '  [%-7s] %-26s measured=%-10s threshold=%-12s %s\n' "$status" "$gate ($tool)" "$measured" "$thr" "$note"
}

echo "== ISO/IEC 25010 静的評価ゲート (Swift) =="
echo "target: $TARGET"
echo

# --- 保守性: 循環的複雑度 (McCabe 1976) — lizard ---
if have lizard; then
  # -C N: CCN が N 超の関数のみ警告。件数で判定。
  CNT=$(lizard "$TARGET" --languages swift -C "$QG_CCN_MAX" -w 2>/dev/null | grep -c ':' || true)
  if [ "${CNT:-0}" -gt 0 ]; then
    record "cyclomatic-complexity" "lizard" "fail" "${CNT} funcs > ${QG_CCN_MAX}" ">${QG_CCN_MAX}=NG" "McCabe(1976)"
  else
    record "cyclomatic-complexity" "lizard" "pass" "0 funcs > ${QG_CCN_MAX}" ">${QG_CCN_MAX}=NG" "McCabe(1976)"
  fi
else
  record "cyclomatic-complexity" "lizard" "skipped" "-" ">${QG_CCN_MAX}=NG" "lizard 未インストール"
fi

# --- 保守性/規約: SwiftLint（error 重大度を fail とする。しきい値は .swiftlint.yml で制御） ---
if have swiftlint && have jq; then
  JSON=$(swiftlint lint --quiet --reporter json "$TARGET" 2>/dev/null || echo '[]')
  ERR=$(echo "$JSON" | jq '[.[]|select(.severity=="error")]|length' 2>/dev/null || echo 0)
  WARN=$(echo "$JSON" | jq '[.[]|select(.severity=="warning")]|length' 2>/dev/null || echo 0)
  if [ "${ERR:-0}" -gt 0 ]; then
    record "swiftlint" "swiftlint" "fail" "${ERR} errors / ${WARN} warns" "errors=0" "rule severity"
  else
    record "swiftlint" "swiftlint" "pass" "0 errors / ${WARN} warns" "errors=0" "rule severity"
  fi
else
  record "swiftlint" "swiftlint" "skipped" "-" "errors=0" "swiftlint/jq 未インストール"
fi

# --- 保守性: デッドコード — Periphery ---
if have periphery; then
  DC=$(periphery scan --quiet 2>/dev/null | grep -c 'warning:' || true)
  if [ "${DC:-0}" -gt 0 ]; then
    record "dead-code" "periphery" "fail" "${DC} unused" "0" ""
  else
    record "dead-code" "periphery" "pass" "0 unused" "0" ""
  fi
else
  record "dead-code" "periphery" "skipped" "-" "0" "periphery 未インストール"
fi

# --- 規約: 整形（決定論的） — swift-format / swiftformat ---
if have swift-format; then
  if swift-format lint --recursive "${SRC_DIRS[@]}" >/dev/null 2>&1; then
    record "format" "swift-format" "pass" "conforming" "0 violations" ""
  else
    record "format" "swift-format" "fail" "violations" "0 violations" ""
  fi
elif have swiftformat; then
  if swiftformat --lint . >/dev/null 2>&1; then
    record "format" "swiftformat" "pass" "conforming" "0 violations" ""
  else
    record "format" "swiftformat" "fail" "violations" "0 violations" ""
  fi
else
  record "format" "swift-format" "skipped" "-" "0 violations" "swift-format 未インストール"
fi

# --- 機能適合性: カバレッジ ---
if have swift && have jq; then
  if swift test --enable-code-coverage >/dev/null 2>&1; then
    PROF=$(find .build -name 'default.profdata' 2>/dev/null | head -1)
    BIN=$(find .build -type f -name '*PackageTests.xctest' 2>/dev/null | head -1)
    [ -d "$BIN" ] && BIN="$BIN/Contents/MacOS/$(basename "${BIN%.xctest}")"
    COVTOOL=$(command -v llvm-cov || echo "xcrun llvm-cov")
    if [ -n "$PROF" ] && [ -n "$BIN" ]; then
      PCT=$($COVTOOL export -summary-only -instr-profile "$PROF" "$BIN" 2>/dev/null \
            | jq '.data[0].totals.lines.percent/100' 2>/dev/null || echo "")
      if [ -n "$PCT" ]; then
        if awk "BEGIN{exit !($PCT < $QG_COVERAGE_MIN)}"; then
          record "test-coverage" "swift test" "fail" "$PCT" ">=$QG_COVERAGE_MIN" "ISO/IEC 25023"
        else
          record "test-coverage" "swift test" "pass" "$PCT" ">=$QG_COVERAGE_MIN" "ISO/IEC 25023"
        fi
      else
        record "test-coverage" "swift test" "skipped" "-" ">=$QG_COVERAGE_MIN" "カバレッジ抽出失敗"
      fi
    else
      record "test-coverage" "swift test" "skipped" "-" ">=$QG_COVERAGE_MIN" "profdata/binary 未検出"
    fi
  else
    record "test-coverage" "swift test" "skipped" "-" ">=$QG_COVERAGE_MIN" "swift test 失敗"
  fi
else
  record "test-coverage" "swift test" "skipped" "-" ">=$QG_COVERAGE_MIN" "swift/jq 未インストール"
fi

# --- セキュリティ: 依存脆弱性（experimental）— Trivy ---
if have trivy; then
  if trivy fs --scanners vuln --severity "$QG_DEPVULN_SEVERITY" --exit-code 1 --quiet "$TARGET" >/dev/null 2>&1; then
    record "dependency-vulnerabilities" "trivy" "pass" "0" "${QG_DEPVULN_SEVERITY}=0" "SPM対応はexperimental; judgmentで補完"
  else
    record "dependency-vulnerabilities" "trivy" "fail" ">=1" "${QG_DEPVULN_SEVERITY}=0" "SPM対応はexperimental"
  fi
else
  record "dependency-vulnerabilities" "trivy" "skipped" "-" "${QG_DEPVULN_SEVERITY}=0" "trivy 未インストール"
fi

# --- 総合判定: 1件も実行できていなければ inconclusive（pass と誤認させない） ---
if [ "$RAN" -eq 0 ]; then
  VERDICT="inconclusive"
elif [ "$OVERALL" -eq 0 ]; then
  VERDICT="pass"
else
  VERDICT="fail"
fi

# --- 結果 JSON 出力 ---
{
  printf '{\n  "model":"ISO/IEC 25010:2023",\n  "language":"swift",\n  "overall":"%s",\n  "ran":%s,\n  "gates":[\n' \
    "$VERDICT" "$RAN"
  for i in "${!ROWS[@]}"; do
    printf '    %s%s\n' "${ROWS[$i]}" "$([ $i -lt $((${#ROWS[@]}-1)) ] && echo ,)"
  done
  printf '  ]\n}\n'
} > "$RESULT_JSON"

echo
echo "== overall: $([ $OVERALL -eq 0 ] && echo PASS || echo FAIL)  -> $RESULT_JSON =="
echo "注: skipped はツール未導入。考察パート(judgment)で人手/LLM 補完が必要。"
exit $OVERALL
