# Code Mental Model architecture

The Python package does not infer repository semantics. An agent reads the code and supplies an analysis draft; the package validates, lays out, and renders it.

## Processing flow

```text
agent analysis draft JSON
  → analysis_json.RawMentalModelAnalysis
  → canonicalizer.canonicalize + code_lens.build_code_lens
  → domain.MentalModel
  → layout_engine.best_layout + readability.measure
  → layout_model.GraphLayout
  → presentation.build_presentation
  → presentation.PresentationModel
  → render_html.serialize → HTML

model_json: canonical JSON ↔ ModelDocument(MentalModel + version/locale header)
build_application: cache reuse or canonicalization from supplied inputs
generate_application: layouts + presentation + serialization
infrastructure: source files, Git, assets, and artifact writes
artifact_metadata: input fingerprint and provenance, outside MentalModel
CLI scripts: arguments and external I/O only
```

`domain.py` describes the semantic graph without coordinates, markup, or external I/O. `analysis_json.py` validates the uncertain draft; `model_json.py` validates and serializes the trusted canonical document. `canonicalizer.py` owns stable IDs and ordering. `code_lens.py` links validated source locations to excerpts. `layout_engine.py` generates deterministic candidates; `readability.py` measures them. `presentation.py` chooses localized display content, and `render_html.py` serializes that content. The application modules compose these steps without moving decisions into the renderer.

Execution scenarios belong to the canonical model as edge step numbers. The presentation layer supplies scenario labels and step explanations. The generated page shows only the nodes and edges of the selected scenario in Execution mode; switching to a scenario that excludes the selected item clears that selection. Structure and Change modes use the same graph IDs and layout.

The canonical JSON envelope retains version and locale fields for compatibility; they are represented by `ModelHeader`, outside `MentalModel`. Git revisions, input hashes, asset hashes, and fingerprints belong to `ArtifactMetadata`.
`canonical.py` and `graph_layout.py` retain the dictionary-based entry points for callers of those APIs; the typed modules own the implementation.

## Version changes

| Version | Change when |
| --- | --- |
| `schemaVersion` | The serialized canonical model becomes incompatible. |
| `rendererVersion` | Layout, presentation, or HTML output behavior changes. |
| `skillVersion` | A new skill bundle version is published. |

The plugin manifests and the marketplace entry use the published `skillVersion`. They are release metadata; neither changes the canonical schema.

An internal refactor that preserves these contracts does not require a version change. The input fingerprint includes production code and renderer assets, so a changed implementation still triggers a checked rebuild.

## Verification boundaries

`test_fixture.py` locks Checkout ordering, JSON and HTML output, mobile relationship labels, and readability metrics. `test_graph_variants.py` exercises distinct graph shapes and malformed inputs. `test_domain_model.py` checks value invariants and canonical JSON round trips. `test_execution_explanation.py` checks scenario labels and step explanations. `verify_reproducibility.py` renders in separate processes; `verify_graph_readability.py` rejects collisions and fixture regressions.

`test_build_application.py` checks fingerprint reuse, changed assets, and tampered model rejection. Run the tools with Python 3.12; run `mypy --strict` from the plugin directory for the whole scripts tree.

`test_label_attribution.py` checks that a label either sits on its own edge or has a rendered connector whose anchor reaches that edge. The readability score also includes total connector length, so candidate selection favors labels that are easy to associate with their arrows.

The compact orthogonal candidates keep the Checkout story together while retaining distinct lanes for reciprocal edges. Labels normally sit beside their edge without a badge or leader; a leader is rendered only when the label must move away. `presentation.py` puts the selected item's evidence beside its meaning and Code Lens, and prepares a separate whole-model evidence summary for the page footer.
