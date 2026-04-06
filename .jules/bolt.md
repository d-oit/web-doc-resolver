## 2025-05-22 - [Fix] Semantic Cache Early Return Bug
**Learning:** Found a critical bug in `SemanticCache` where lazy-loading checks were preventing the model from ever being loaded. `query()` and `store()` checked `if not self._model: return` before calling `_compute_embedding()`, which was the only function that could load `self._model`.
**Action:** Always ensure that lazy-loading check locations don't block the actual loading call. Verified that removing this check correctly allows the model to load on the first demand.
