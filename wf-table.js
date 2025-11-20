(function() {
				class WFTable {
					constructor(host) {
						this.host = host;
						const dataEl = host.querySelector(".wf-table__data");
						let payload = { columns: [], rows: [], unique: {} };
						if (dataEl) {
							try {
								payload = JSON.parse(
									dataEl.textContent || "{}"
								);
							} catch (err) {
								console.warn("WFTable: JSON parse failed", err);
							}
						}
						this.payload = payload;
						this.columns = this.payload.columns || [];
						this.rows = this.payload.rows || [];
						this.unique = this.payload.unique || {};
						this.sortable = host.dataset.sortable === "true";
						this.filterable = host.dataset.filterable === "true";
						this.showRowNumbers =
							host.dataset.rowNumbers === "true";
						this.pageSize = Number(host.dataset.pageSize || 10);

						this.filterMinW = Number(
							host.dataset.filterMinW || 220
						);
						this.filterMaxW = Number(
							host.dataset.filterMaxW || 420
						);
						this.filterAutoW = host.dataset.filterAutoW !== "false";
						this.filterPadW = Number(host.dataset.filterPadW || 56);
						this.filterWidth = Number(
							host.dataset.filterWidth || 0
						);
						this.filterAlign = host.dataset.filterAlign || "auto";

						this.tbody = host.querySelector(".wf-table__body");
						this.theadRow = host.querySelector(
							".wf-table__head-row"
						);
						this.info = host.querySelector(".wf-info");
						this.psEl = host.querySelector(".wf-pagesize");
						this.pbtns = host.querySelector(".wf-pbtns");

						this.currentPage = 1;
						this.filtered = [...this.rows];
						this.sortCol = null;
						this.sortDir = null;
						this.filters = {};

						this._wire();
						this._renderHeader();
						this._update();
					}

					_wire() {
						if (this.psEl) {
							this.psEl.value = String(this.pageSize);
							this.psEl.addEventListener("change", e => {
								const v = Number(e.target.value);
								this.pageSize =
									Number.isFinite(v) && v > 0 ? v : 10;
								this.currentPage = 1;
								this._update();
							});
						}
					}

					_renderHeader() {
						this.theadRow.innerHTML = "";
						for (const col of this.columns) {
							const th = document.createElement("th");
							if (col === "__row_number__") {
								th.className = "row-number";
								th.textContent = "#";
							} else {
								const wrap = document.createElement("div");
								wrap.className = "wf-hc";

								const txt = document.createElement("span");
								txt.className = "wf-ht";
								txt.textContent = col;
								wrap.appendChild(txt);

								const acts = document.createElement("div");
								acts.className = "wf-acts";

								if (this.sortable) {
									const sbtn = document.createElement(
										"button"
									);
									sbtn.className = "wf-btn";
									sbtn.textContent = "↕";
									sbtn.addEventListener("click", () =>
										this._handleSort(col, sbtn)
									);
									acts.appendChild(sbtn);
								}
								if (this.filterable) {
									const fbtn = document.createElement(
										"button"
									);
									fbtn.className = "wf-btn";
									fbtn.textContent = "≡";
									fbtn.addEventListener("click", ev => {
										ev.stopPropagation();
										this._toggleFilter(col, th);
									});
									acts.appendChild(fbtn);
								}
								wrap.appendChild(acts);
								th.appendChild(wrap);
								th.style.position = "relative";
							}
							this.theadRow.appendChild(th);
						}
					}

					_handleSort(column, btn) {
						this.host.querySelectorAll(".wf-btn").forEach(b => {
							if (b !== btn && b.textContent.match(/[↑↓]/))
								b.textContent = "↕";
							b.classList.remove("active");
						});

						if (this.sortCol === column) {
							if (this.sortDir === "asc") {
								this.sortDir = "desc";
								btn.textContent = "↓";
							} else if (this.sortDir === "desc") {
								this.sortDir = null;
								this.sortCol = null;
								btn.textContent = "↕";
							}
						} else {
							this.sortCol = column;
							this.sortDir = "asc";
							btn.textContent = "↑";
						}
						if (this.sortDir) btn.classList.add("active");
						this._apply();
					}

					_toggleFilter(column, th) {
						document
							.querySelectorAll(".wf-filter.wf-float")
							.forEach(d => d.remove());

						const dd = document.createElement("div");
						dd.className = "wf-filter wf-float show";
						Object.assign(dd.style, {
							position: "fixed",
							zIndex: 9999,
							background: "#fff",
							border: "1px solid #e1e4e8",
							borderRadius: "6px",
							boxShadow: "0 10px 24px rgba(0,0,0,.12)",
							padding: "8px",
							width: "420px",
							minWidth: "380px",
							maxWidth: "480px"
						});

						const search = document.createElement("input");
						search.type = "text";
						search.placeholder = "Ara...";
						Object.assign(search.style, {
							width: "100%",
							boxSizing: "border-box",
							marginBottom: "6px"
						});
						dd.appendChild(search);

						const list = document.createElement("div");
						list.style.overflow = "auto";
						const values = (this.unique[column] || []).map(v =>
							v === null || v === "" ? "(Boş)" : String(v)
						);
						const selected = this.filters[column];

						const makeRow = label => {
							const lab = document.createElement("label");
							lab.className = "wf-opt";
							Object.assign(lab.style, {
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "6px 4px"
							});
							const cb = document.createElement("input");
							cb.type = "checkbox";
							cb.checked =
								selected == null
									? true
									: selected.includes(label);
							cb.addEventListener("change", () =>
								this._updateFilter(column, label, cb.checked)
							);
							const sp = document.createElement("span");
							sp.textContent = label;
							lab.appendChild(cb);
							lab.appendChild(sp);
							return lab;
						};

						values.forEach(v => list.appendChild(makeRow(v)));
						dd.appendChild(list);

						const acts = document.createElement("div");
						acts.className = "wf-facts";
						Object.assign(acts.style, {
							display: "flex",
							gap: "8px",
							justifyContent: "flex-end",
							marginTop: "8px"
						});

						const all = document.createElement("button");
						all.className = "wf-fbtn";
						all.textContent = "Tümü";
						all.addEventListener("click", ev => {
							ev.preventDefault();
							this.filters[column] = null;
							search.value = "";
							list.querySelectorAll(
								'input[type="checkbox"]'
							).forEach(cb => (cb.checked = true));
							this._apply();
						});

						const clr = document.createElement("button");
						clr.className = "wf-fbtn";
						clr.textContent = "Temizle";
						clr.addEventListener("click", ev => {
							ev.preventDefault();
							this.filters[column] = [];
							search.value = "";
							list.querySelectorAll(
								'input[type="checkbox"]'
							).forEach(cb => (cb.checked = false));
							this._apply();
						});

						acts.appendChild(all);
						acts.appendChild(clr);
						dd.appendChild(acts);
						document.body.appendChild(dd);

						const position = () => {
							const r = th.getBoundingClientRect();
							const pad = 8;
							const minW = Math.max(180, this.filterMinW);
							const maxW = Math.max(
								minW,
								Math.min(
									this.filterMaxW || 480,
									window.innerWidth - 2 * pad
								)
							);
							let desired =
								this.filterWidth > 0 ? this.filterWidth : minW;

							if (this.filterWidth <= 0 && this.filterAutoW) {
								const ctx = (position._ctx ||= document
									.createElement("canvas")
									.getContext("2d"));
								const cs = getComputedStyle(dd);
								ctx.font =
									cs.font ||
									`${cs.fontSize} ${cs.fontFamily}`;
								let maxText = 0;
								list.querySelectorAll(".wf-opt span").forEach(
									sp => {
										const w = Math.ceil(
											ctx.measureText(
												sp.textContent || ""
											).width
										);
										if (w > maxText) maxText = w;
									}
								);
								desired = maxText + this.filterPadW + 36;
							}

							const width = Math.max(
								minW,
								Math.min(desired, maxW)
							);
							dd.style.width = width + "px";

							let left;
							const canLeft =
								r.left <= window.innerWidth - pad - width;
							if (
								this.filterAlign === "left" ||
								(this.filterAlign === "auto" && canLeft)
							) {
								left = Math.max(
									pad,
									Math.min(
										r.left,
										window.innerWidth - pad - width
									)
								);
							} else {
								left = Math.max(
									pad,
									Math.min(
										r.right - width,
										window.innerWidth - pad - width
									)
								);
							}
							dd.style.left = left + "px";

							const below = window.innerHeight - r.bottom - pad;
							const above = r.top - pad;
							const chrome =
								search.offsetHeight + acts.offsetHeight + 24;

							if (below >= 220 || below >= above) {
								dd.style.top = r.bottom + 4 + "px";
								dd.style.bottom = "auto";
								const avail = Math.max(180, below - 4);
								list.style.maxHeight =
									Math.max(120, avail - chrome) + "px";
							} else {
								dd.style.top = "auto";
								dd.style.bottom =
									window.innerHeight - r.top + 4 + "px";
								const avail = Math.max(180, above - 4);
								list.style.maxHeight =
									Math.max(120, avail - chrome) + "px";
							}
						};

						const filterBySearch = e => {
							const q = (e.target.value || "").toLowerCase();
							list.querySelectorAll(".wf-opt").forEach(el => {
								el.style.display = el.textContent
									.toLowerCase()
									.includes(q)
									? "flex"
									: "none";
							});
						};
						search.addEventListener("input", filterBySearch);

						const close = ev => {
							if (!dd.contains(ev.target)) {
								cleanup();
							}
						};
						const onKey = ev => {
							if (ev.key === "Escape") {
								cleanup();
							}
						};
						const onScroll = () => position();
						const cleanup = () => {
							dd.remove();
							document.removeEventListener("click", close, true);
							document.removeEventListener(
								"keydown",
								onKey,
								true
							);
							document.removeEventListener(
								"scroll",
								onScroll,
								true
							);
							window.removeEventListener("resize", position);
						};

						setTimeout(() => {
							position();
							document.addEventListener("click", close, true);
							document.addEventListener("keydown", onKey, true);
							document.addEventListener("scroll", onScroll, true);
							window.addEventListener("resize", position);
						}, 0);
					}

					_updateFilter(column, value, checked) {
						if (!Array.isArray(this.filters[column]))
							this.filters[column] = [];
						const arr = this.filters[column];
						const idx = arr.indexOf(value);
						if (checked && idx === -1) arr.push(value);
						if (!checked && idx > -1) arr.splice(idx, 1);
						this._apply();
					}

					_apply() {
						this.filtered = [...this.rows];
						Object.keys(this.filters).forEach(col => {
							const arr = this.filters[col];
							if (Array.isArray(arr) && arr.length > 0) {
								this.filtered  = this.filtered .filter(r => {
									let v = r[col];
									v =
										v === null || v === ""
											? "(Boş)"
											: String(v);
									return arr.includes(v);
								});
							}
						});

						if (this.sortCol && this.sortDir) {
							const c = this.sortCol,
								dir = this.sortDir;
							this.filtered .sort((a, b) => {
								let A = a[c],
									B = b[c];
								if (A == null && B == null) return 0;
								if (A == null) return 1;
								if (B == null) return -1;
								if (typeof A === "string") A = A.toLowerCase();
								if (typeof B === "string") B = B.toLowerCase();
								if (A < B) return dir === "asc" ? -1 : 1;
								if (A > B) return dir === "asc" ? 1 : -1;
								return 0;
							});
						}
						this.currentPage = 1;
						this._update();
					}

					_update() {
						const start = (this.currentPage - 1) * this.pageSize;
						const pageData = this.filtered .slice(
							start,
							start + this.pageSize
						);
						const oldRows = Array.from(
							this.tbody.querySelectorAll("tr")
						);

						pageData.forEach((row, i) => {
							const colVals = this.columns.map(
								c => (row[c] ?? "") + ""
							);
							const existing = oldRows[i];
							if (!existing) {
								const tr = document.createElement("tr");
								colVals.forEach((val, j) => {
									const td = document.createElement("td");
									if (this.columns[j] === "__row_number__")
										td.className = "wf-num";
									td.textContent = val;
									tr.appendChild(td);
								});
								this.tbody.appendChild(tr);
							} else {
								const cells = existing.children;
								colVals.forEach((val, j) => {
									if (
										cells[j] &&
										cells[j].textContent !== val
									) {
										cells[j].textContent = val;
									}
								});
							}
						});

						while (this.tbody.children.length > pageData.length) {
							this.tbody.removeChild(this.tbody.lastChild);
						}

						const totalPages = Math.max(
							1,
							Math.ceil(this.filtered .length / this.pageSize)
						);
						if (this.info)
							this.info.textContent = `Sayfa ${this.currentPage} / ${totalPages} (${this.filtered .length} kayıt)`;

						const btns = this.pbtns;
						if (!btns) return;
						btns.innerHTML = "";

						const prev = document.createElement("button");
						prev.className = "wf-pbtn";
						prev.textContent = "◄";
						prev.disabled = this.currentPage === 1;
						prev.addEventListener("click", () => {
							this.currentPage--;
							this._update();
						});
						btns.appendChild(prev);

						const maxButtons = 7;
						let s = Math.max(
							1,
							this.currentPage - Math.floor(maxButtons / 2)
						);
						let e = Math.min(totalPages, s + maxButtons - 1);
						if (e - s < maxButtons - 1)
							s = Math.max(1, e - maxButtons + 1);

						for (let i = s; i <= e; i++) {
							const b = document.createElement("button");
							b.className =
								"wf-pbtn" +
								(i === this.currentPage ? " active" : "");
							b.textContent = String(i);
							b.addEventListener("click", () => {
								this.currentPage = i;
								this._update();
							});
							btns.appendChild(b);
						}

						const next = document.createElement("button");
						next.className = "wf-pbtn";
						next.textContent = "►";
						next.disabled = this.currentPage === totalPages;
						next.addEventListener("click", () => {
							this.currentPage++;
							this._update();
						});
						btns.appendChild(next);
					}

					static initAll(root = document) {
						root.querySelectorAll(".wf-table-host").forEach(h => {
							if (!h._wfTable) h._wfTable = new WFTable(h);
						});
					}
				}

				window.WFTable = WFTable;

				if (document.readyState === "loading") {
					document.addEventListener("DOMContentLoaded", () =>
						WFTable.initAll()
					);
				} else {
					WFTable.initAll();
				}
			})();