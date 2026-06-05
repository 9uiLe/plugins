# Third-Party Licenses (vendor 配下)

このディレクトリには tech-docs プラグインが生成する HTML から参照される
第三者製ライブラリの minified 配布物を同梱している。各ライブラリのライセンス
全文と帰属表記を以下に記録する (採用経緯は `docs/adr/0002-vendor-prism-mermaid.html`)。

minify の過程で配布物先頭のライセンスバナーが除去されているため、本ファイルが
それぞれのライセンス条文上の「include the above copyright notice」要件を充足する。

---

## Prism — `prism.min.js`, `prism-tomorrow.min.css`, `prism-components/prism-*.min.js`

- 同梱バージョン: **1.29.0**
- 取得元: <https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/>
- 上流: <https://github.com/PrismJS/prism>
- ライセンス: MIT

```
MIT LICENSE

Copyright (c) 2012 Lea Verou

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Mermaid — `mermaid.min.js`

- 同梱バージョン: **10.9.1**
- 取得元: <https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js>
- 上流: <https://github.com/mermaid-js/mermaid>
- ライセンス: MIT

```
MIT License

Copyright (c) 2014 - 2024 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Integrity

各ファイルの SHA-256 ハッシュは同階層の `SHA256SUMS` に記録されており、
CI (`.github/workflows/verify-vendor.yml`) で commit ごとに verify される。

vendor アップグレード手順は `.github/ISSUE_TEMPLATE/vendor_upgrade.yml` を参照。
