(() => {
  'use strict';

  /* ================== Constantes e utilidades ================== */
  const STORAGE_KEY = 'tarefas:v1';
  const COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#64748b'];
  const PRIORITY_LABEL = { 1: 'Baixa', 2: 'Média', 3: 'Alta' };
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'automático', light: 'claro', dark: 'escuro' };
  const THEME_ICON = { auto: 'i-auto', light: 'i-sun', dark: 'i-moon' };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function localISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  /** ISO (UTC) → valor de <input type="datetime-local"> no fuso do aparelho. */
  function toLocalInput(iso) {
    const d = new Date(iso);
    return `${localISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return localISO(d);
  }
  const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const fmtShort = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  function svgIcon(id, cls = 'ico') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'title') node.setAttribute(k, v);
      else node[k] = v;
    }
    for (const c of children) if (c) node.append(c);
    return node;
  }

  /* ================== Seleção personalizada ==================
   * Substitui a lista aberta do <select> nativo (que usa o visual do sistema)
   * por um menu com o mesmo estilo do app. O <select> continua no DOM, escondido,
   * guardando o valor — então formulários e `select.value` funcionam igual. */
  const selectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  let openMenu = null;

  function optionContent(opt) {
    const parts = [];
    if (opt.dataset.color) {
      const ico = svgIcon('i-flag', 'ico opt-ico');
      ico.style.color = opt.dataset.color;
      parts.push(ico);
    } else if (opt.dataset.icon) {
      parts.push(svgIcon(opt.dataset.icon, 'ico opt-ico'));
    } else if (opt.dataset.dot) {
      parts.push(el('span', { class: 'dot', style: `background:${opt.dataset.dot}` }));
    }
    parts.push(el('span', { class: 'opt-label', text: opt.textContent }));
    return parts;
  }

  function enhanceSelect(select) {
    const label = select.getAttribute('aria-label') || '';
    const wrap = el('div', { class: `select ${select.className}`.trim() });
    const trigger = el('button', { type: 'button', class: 'select-trigger', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    const menu = el('ul', { class: 'select-menu', role: 'listbox', hidden: true, 'aria-label': label || null });
    select.className = '';
    select.hidden = true;
    select.tabIndex = -1;
    select.replaceWith(wrap);
    wrap.append(select, trigger, menu);

    function update() {
      const opt = select.options[select.selectedIndex];
      trigger.replaceChildren(...(opt ? optionContent(opt) : []), svgIcon('i-chevron', 'ico chevron'));
      if (label) trigger.setAttribute('aria-label', `${label}: ${opt ? opt.textContent : ''}`);
    }

    function open() {
      if (openMenu && openMenu.close !== close) openMenu.close();
      menu.replaceChildren(...Array.from(select.options, (opt, i) =>
        el('li', { class: 'select-option', role: 'option', tabIndex: -1, 'data-index': String(i), 'aria-selected': String(i === select.selectedIndex) },
          ...optionContent(opt), svgIcon('i-check', 'ico opt-check'))));
      menu.hidden = false;
      menu.classList.remove('up', 'right');
      const r = menu.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8 && trigger.getBoundingClientRect().top > r.height + 16) menu.classList.add('up');
      if (r.right > window.innerWidth - 8) menu.classList.add('right');
      wrap.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild)?.focus({ preventScroll: true });
      openMenu = { wrap, close };
    }

    function close(focusTrigger = false) {
      if (menu.hidden) return;
      menu.hidden = true;
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      if (openMenu && openMenu.close === close) openMenu = null;
      if (focusTrigger) trigger.focus();
    }

    function choose(index) {
      if (index !== select.selectedIndex) {
        select.selectedIndex = index;
        update();
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close(true);
    }

    // `select.value = x` no código também atualiza o botão.
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return selectValue.get.call(this); },
      set(v) { selectValue.set.call(this, v); update(); },
    });

    trigger.addEventListener('click', () => (menu.hidden ? open() : close()));
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('.select-option');
      if (li) choose(Number(li.dataset.index));
    });
    menu.addEventListener('pointermove', (e) => {
      const li = e.target.closest('.select-option');
      if (li && document.activeElement !== li) li.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', (e) => {
      const items = Array.from(menu.children);
      const i = items.indexOf(document.activeElement);
      const go = (n) => items[(n + items.length) % items.length]?.focus();
      switch (e.key) {
        case 'ArrowDown': go(i + 1); break;
        case 'ArrowUp': go(i - 1); break;
        case 'Home': go(0); break;
        case 'End': go(items.length - 1); break;
        case 'Enter': case ' ': if (i >= 0) choose(i); break;
        case 'Escape': close(true); e.stopPropagation(); break;
        case 'Tab': close(); return;
        default: return;
      }
      e.preventDefault();
    });

    update();
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !openMenu.wrap.contains(e.target)) openMenu.close();
  });
  $$('select').forEach(enhanceSelect);

  /* ================== Estado ================== */
  function makeTask(listId, title, extra = {}) {
    return {
      id: uid(), listId, title, notes: '', done: false, due: '', remindAt: '', priority: 0,
      createdAt: Date.now(), completedAt: null, ...extra,
    };
  }

  function seedState() {
    const pessoal = { id: uid(), name: 'Pessoal', color: COLORS[0] };
    const trabalho = { id: uid(), name: 'Trabalho', color: COLORS[1] };
    const mercado = { id: uid(), name: 'Mercado', color: COLORS[2] };
    const today = localISO();
    return {
      lists: [pessoal, trabalho, mercado],
      tasks: [
        makeTask(pessoal.id, 'Toque no círculo para concluir uma tarefa'),
        makeTask(pessoal.id, 'Toque no texto para editar, adicionar data ou anotações', { due: today }),
        makeTask(pessoal.id, 'Instale o app na tela inicial para usar offline', { priority: 1 }),
        makeTask(trabalho.id, 'Enviar relatório semanal', { due: addDays(today, 1), priority: 3 }),
        makeTask(trabalho.id, 'Organizar a caixa de entrada', { priority: 2 }),
        makeTask(mercado.id, 'Pão'),
        makeTask(mercado.id, 'Leite'),
        makeTask(mercado.id, 'Frutas', { done: true, completedAt: Date.now() }),
      ],
      view: pessoal.id,
      filter: 'all',
      sort: 'manual',
      theme: 'auto',
    };
  }

  function isValidState(s) {
    return s && typeof s === 'object' && Array.isArray(s.lists) && Array.isArray(s.tasks) &&
      s.lists.every((l) => l && typeof l.id === 'string' && typeof l.name === 'string') &&
      s.tasks.every((t) => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.listId === 'string');
  }

  function sanitize(s) {
    const listIds = new Set(s.lists.map((l) => l.id));
    const clean = {
      lists: s.lists.map((l) => ({ id: l.id, name: String(l.name).slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : COLORS[0] })),
      tasks: s.tasks.filter((t) => listIds.has(t.listId)).map((t) => ({
        id: t.id,
        listId: t.listId,
        title: String(t.title).slice(0, 200),
        notes: String(t.notes || '').slice(0, 2000),
        done: !!t.done,
        due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '',
        remindAt: typeof t.remindAt === 'string' && !Number.isNaN(Date.parse(t.remindAt)) ? t.remindAt : '',
        priority: [0, 1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 0,
        createdAt: Number(t.createdAt) || Date.now(),
        completedAt: t.completedAt ? Number(t.completedAt) : null,
      })),
      view: s.view,
      filter: ['all', 'active', 'done'].includes(s.filter) ? s.filter : 'all',
      sort: ['manual', 'due', 'priority', 'alpha'].includes(s.sort) ? s.sort : 'manual',
      theme: THEMES.includes(s.theme) ? s.theme : 'auto',
    };
    if (!clean.lists.length) clean.lists.push({ id: uid(), name: 'Pessoal', color: COLORS[0] });
    if (!['today', 'all'].includes(clean.view) && !listIds.has(clean.view)) clean.view = clean.lists[0].id;
    return clean;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidState(parsed)) return sanitize(parsed);
      }
    } catch (e) { /* armazenamento indisponível ou corrompido */ }
    return seedState();
  }

  let state = load();
  let search = '';
  let saveWarned = false;
  let justAddedId = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) { toast('Não foi possível salvar neste navegador.'); saveWarned = true; }
    }
  }

  function commit() { save(); render(); scheduleReminderSync(); }

  const getList = (id) => state.lists.find((l) => l.id === id) || null;
  const getTask = (id) => state.tasks.find((t) => t.id === id) || null;
  const currentList = () => getList(state.view);

  /* ================== Seleção de tarefas ================== */
  function tasksInView() {
    const today = localISO();
    if (state.view === 'all') return state.tasks.slice();
    if (state.view === 'today') {
      return state.tasks.filter((t) => t.due && ((!t.done && t.due <= today) || (t.done && t.due === today)));
    }
    return state.tasks.filter((t) => t.listId === state.view);
  }

  function visibleTasks(base) {
    let list = base;
    if (state.filter === 'active') list = list.filter((t) => !t.done);
    else if (state.filter === 'done') list = list.filter((t) => t.done);

    if (search.trim()) {
      const q = normalize(search.trim());
      list = list.filter((t) => normalize(t.title).includes(q) || normalize(t.notes).includes(q));
    }

    const order = new Map(state.tasks.map((t, i) => [t.id, i]));
    const cmp = {
      manual: (a, b) => order.get(a.id) - order.get(b.id),
      due: (a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || b.priority - a.priority || order.get(a.id) - order.get(b.id),
      priority: (a, b) => b.priority - a.priority || (a.due || '9999').localeCompare(b.due || '9999') || order.get(a.id) - order.get(b.id),
      alpha: (a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }),
    }[state.sort];

    return list.slice().sort((a, b) => (a.done - b.done) || cmp(a, b));
  }

  function pendingCount(view) {
    const today = localISO();
    return state.tasks.filter((t) => {
      if (t.done) return false;
      if (view === 'all') return true;
      if (view === 'today') return t.due && t.due <= today;
      return t.listId === view;
    }).length;
  }

  /* ================== Renderização ================== */
  const els = {
    lists: $('#lists'),
    tasks: $('#tasks'),
    title: $('#view-title'),
    sub: $('#view-sub'),
    dot: $('#view-dot'),
    progress: $('#progress-bar'),
    empty: $('#empty'),
    emptyTitle: $('#empty-title'),
    emptyText: $('#empty-text'),
    listActions: $('#list-actions'),
    clearDone: $('#clear-done-btn'),
    sort: $('#sort'),
    themeBtn: $('#theme-btn'),
    addForm: $('#add-form'),
    newTitle: $('#new-title'),
    newDue: $('#new-due'),
    newPriority: $('#new-priority'),
  };

  function render() {
    renderSidebar();
    renderHeader();
    renderTasks();
    renderTheme();
  }

  function renderSidebar() {
    for (const btn of $$('.nav-item[data-view]')) {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    }
    $('[data-count="today"]').textContent = pendingCount('today') || '';
    $('[data-count="all"]').textContent = pendingCount('all') || '';

    els.lists.replaceChildren(...state.lists.map((list) => {
      const active = list.id === state.view;
      const btn = el('button', { class: 'nav-item' + (active ? ' active' : ''), 'data-view': list.id, 'aria-current': active ? 'page' : null },
        el('span', { class: 'dot', style: `background:${list.color}` }),
        el('span', { class: 'nav-label', text: list.name }),
        el('span', { class: 'count', text: String(pendingCount(list.id) || '') }),
      );
      return el('li', {}, btn);
    }));
  }

  function renderHeader() {
    const list = currentList();
    const base = tasksInView();
    const done = base.filter((t) => t.done).length;
    const pending = base.length - done;

    if (state.view === 'today') {
      els.title.textContent = 'Hoje';
      const d = fmtLong.format(new Date());
      els.sub.textContent = `${d.charAt(0).toUpperCase() + d.slice(1)} · ${plural(pending, 'pendente', 'pendentes')}`;
    } else {
      els.title.textContent = list ? list.name : 'Todas as tarefas';
      els.sub.textContent = base.length
        ? `${plural(pending, 'pendente', 'pendentes')} · ${plural(done, 'concluída', 'concluídas')}`
        : 'Nenhuma tarefa ainda';
    }
    if (list) els.dot.style.background = list.color; else els.dot.removeAttribute('style');
    els.dot.hidden = !list;
    els.listActions.hidden = !list;
    els.progress.style.width = base.length ? `${Math.round((done / base.length) * 100)}%` : '0%';
    document.title = `${els.title.textContent} · Tarefas`;

    for (const b of $$('.segmented button')) b.setAttribute('aria-selected', String(b.dataset.filter === state.filter));
    els.sort.value = state.sort;
    els.clearDone.hidden = done === 0;
    els.clearDone.querySelector('span').textContent = `Limpar concluídas (${done})`;
  }

  function dueInfo(task) {
    const today = localISO();
    const iso = task.due;
    let text;
    if (iso === today) text = 'Hoje';
    else if (iso === addDays(today, 1)) text = 'Amanhã';
    else if (iso === addDays(today, -1)) text = 'Ontem';
    else {
      const d = parseISO(iso);
      text = fmtShort.format(d).replace('.', '');
      if (d.getFullYear() !== new Date().getFullYear()) text += ` ${d.getFullYear()}`;
    }
    let cls = '';
    if (!task.done && iso < today) cls = 'overdue';
    else if (!task.done && iso === today) cls = 'today';
    return { text, cls };
  }

  function renderTask(task) {
    const showList = state.view === 'all' || state.view === 'today';
    const meta = el('div', { class: 'meta' });

    if (showList) {
      const list = getList(task.listId);
      if (list) meta.append(el('span', { class: 'meta-item' }, el('span', { class: 'dot', style: `background:${list.color}` }), list.name));
    }
    if (task.due) {
      const { text, cls } = dueInfo(task);
      meta.append(el('span', { class: `meta-item ${cls}` }, svgIcon('i-calendar'), cls === 'overdue' ? `${text} · atrasada` : text));
    }
    if (task.priority) {
      meta.append(el('span', { class: `meta-item p${task.priority}` }, svgIcon('i-flag'), PRIORITY_LABEL[task.priority]));
    }
    if (task.remindAt && !task.done) {
      const at = new Date(task.remindAt);
      const day = localISO(at);
      const time = at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const today = localISO();
      const dayText = day === today ? 'Hoje' : day === addDays(today, 1) ? 'Amanhã' : fmtShort.format(at).replace('.', '');
      const past = at.getTime() <= Date.now();
      meta.append(el('span', { class: 'meta-item' + (past ? '' : ' reminder'), title: past ? 'Lembrete enviado' : 'Lembrete' },
        svgIcon('i-bell'), `${dayText}, ${time}`));
    }
    if (task.notes) {
      meta.append(el('span', { class: 'meta-item notes-preview', title: task.notes }, svgIcon('i-note'), task.notes.split('\n')[0]));
    }

    const isNew = task.id === justAddedId;
    return el('li', { class: 'task' + (task.done ? ' done' : '') + (isNew ? ' new' : ''), 'data-id': task.id, 'data-priority': String(task.priority) },
      el('button', {
        class: 'check', role: 'checkbox', 'aria-checked': String(task.done),
        'aria-label': task.done ? `Marcar "${task.title}" como pendente` : `Concluir "${task.title}"`,
      }, svgIcon('i-check')),
      el('div', { class: 'task-body', tabIndex: 0, role: 'button', 'aria-label': `Editar "${task.title}"` },
        el('div', { class: 'task-title', text: task.title }),
        meta,
      ),
      el('button', { class: 'icon-btn danger task-del', 'aria-label': `Excluir "${task.title}"`, title: 'Excluir' }, svgIcon('i-trash')),
    );
  }

  function renderTasks() {
    const base = tasksInView();
    const items = visibleTasks(base);
    els.tasks.replaceChildren(...items.map(renderTask));

    const empty = items.length === 0;
    els.empty.hidden = !empty;
    if (!empty) return;

    if (search.trim()) {
      setEmpty('Nada encontrado', `Nenhuma tarefa corresponde a “${search.trim()}”.`);
    } else if (base.length === 0) {
      setEmpty(state.view === 'today' ? 'Nada para hoje' : 'Lista vazia',
        state.view === 'today' ? 'Tarefas com data de hoje ou atrasadas aparecem aqui.' : 'Adicione sua primeira tarefa no campo acima.');
    } else if (state.filter === 'active') {
      setEmpty('Tudo feito! 🎉', 'Você concluiu todas as tarefas desta lista.');
    } else {
      setEmpty('Nenhuma concluída', 'As tarefas que você concluir aparecem aqui.');
    }
  }
  function setEmpty(title, text) { els.emptyTitle.textContent = title; els.emptyText.textContent = text; }

  function renderTheme() {
    const t = state.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    els.themeBtn.querySelector('use').setAttribute('href', '#' + THEME_ICON[t]);
    els.themeBtn.querySelector('span').textContent = `Tema: ${THEME_LABEL[t]}`;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#151c19' : '#15803d');
  }

  /* ================== Toast ================== */
  let toastTimer = 0;
  let toastActionFn = null;
  function toast(message, actionLabel, actionFn, ms = 5000) {
    const box = $('#toast');
    const btn = $('#toast-action');
    $('#toast-msg').textContent = message;
    toastActionFn = actionFn || null;
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    box.classList.add('show');
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() { $('#toast').classList.remove('show'); toastActionFn = null; }
  $('#toast-action').addEventListener('click', () => {
    const fn = toastActionFn;
    hideToast();
    if (fn) fn();
  });

  /* ================== Ações de tarefas ================== */
  function addTask(title, due, priority) {
    let listId = currentList()?.id;
    if (!listId) listId = state.lists[0].id;
    if (state.view === 'today' && !due) due = localISO();
    const task = makeTask(listId, title, { due, priority });
    state.tasks.push(task);
    if (state.filter === 'done') state.filter = 'all';
    justAddedId = task.id;
    commit();
    justAddedId = null;
    if (!currentList()) toast(`Adicionada em “${getList(listId).name}”`);
  }

  function toggleTask(id) {
    const t = getTask(id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    commit();
  }

  function deleteTasks(ids, message) {
    const removed = [];
    state.tasks = state.tasks.filter((t, index) => {
      if (ids.includes(t.id)) { removed.push({ task: t, index }); return false; }
      return true;
    });
    commit();
    toast(message, 'Desfazer', () => {
      for (const { task, index } of removed) state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
      commit();
    });
  }

  /* ================== Diálogo de tarefa ================== */
  const taskDialog = $('#task-dialog');
  const taskForm = $('#task-form');
  let editingId = null;

  function openTaskDialog(id) {
    const t = getTask(id);
    if (!t) return;
    editingId = id;
    const f = taskForm.elements;
    f.title.value = t.title;
    f.notes.value = t.notes;
    f.due.value = t.due;
    f.remindAt.value = t.remindAt ? toLocalInput(t.remindAt) : '';
    f.priority.value = String(t.priority);
    f.listId.replaceChildren(...state.lists.map((l) => el('option', { value: l.id, text: l.name, 'data-dot': l.color })));
    f.listId.value = t.listId;
    taskDialog.showModal();
  }

  taskDialog.addEventListener('close', () => {
    const t = getTask(editingId);
    if (taskDialog.returnValue === 'save' && t) {
      const f = taskForm.elements;
      const title = f.title.value.trim();
      if (title) t.title = title;
      t.notes = f.notes.value.trim();
      t.due = f.due.value;
      // "AAAA-MM-DDTHH:MM" é interpretado no fuso do aparelho; guardamos em ISO (UTC).
      const remind = f.remindAt.value ? new Date(f.remindAt.value) : null;
      t.remindAt = remind && !Number.isNaN(remind.getTime()) ? remind.toISOString() : '';
      t.priority = Number(f.priority.value);
      if (getList(f.listId.value)) t.listId = f.listId.value;
      commit();
    }
    editingId = null;
    taskDialog.returnValue = '';
  });

  $('#task-delete-btn').addEventListener('click', () => {
    const t = getTask(editingId);
    taskDialog.close('cancel');
    if (t) deleteTasks([t.id], 'Tarefa excluída');
  });

  /* ================== Diálogo de lista ================== */
  const listDialog = $('#list-dialog');
  const listForm = $('#list-form');
  let editingListId = null;

  function openListDialog(listId = null) {
    editingListId = listId;
    const list = listId ? getList(listId) : null;
    $('#list-dialog-title').textContent = list ? 'Editar lista' : 'Nova lista';
    const color = list ? list.color : COLORS[state.lists.length % COLORS.length];
    $('#swatches').replaceChildren(...COLORS.map((c, i) =>
      el('label', { class: 'swatch', title: `Cor ${i + 1}` },
        el('input', { type: 'radio', name: 'color', value: c, checked: c === color, 'aria-label': `Cor ${i + 1}` }),
        el('span', { style: `background:${c}` }),
      )));
    listForm.elements.name.value = list ? list.name : '';
    closeDrawer();
    listDialog.showModal();
    listForm.elements.name.focus();
  }

  listDialog.addEventListener('close', () => {
    if (listDialog.returnValue === 'save') {
      const name = listForm.elements.name.value.trim();
      const color = listForm.elements.color.value || COLORS[0];
      if (name) {
        const existing = getList(editingListId);
        if (existing) {
          existing.name = name;
          existing.color = color;
        } else {
          const list = { id: uid(), name, color };
          state.lists.push(list);
          state.view = list.id;
          state.filter = 'all';
          search = '';
          $('#search').value = '';
        }
        commit();
        if (!existing) els.newTitle.focus();
      }
    }
    editingListId = null;
    listDialog.returnValue = '';
  });

  function deleteCurrentList() {
    const list = currentList();
    if (!list) return;
    if (state.lists.length === 1) { toast('Você precisa ter pelo menos uma lista.'); return; }
    const count = state.tasks.filter((t) => t.listId === list.id).length;
    const msg = count
      ? `Excluir a lista “${list.name}” e ${plural(count, 'tarefa', 'tarefas')}?`
      : `Excluir a lista “${list.name}”?`;
    if (!confirm(msg)) return;

    const listIndex = state.lists.indexOf(list);
    const removedTasks = state.tasks.map((t, index) => ({ task: t, index })).filter((x) => x.task.listId === list.id);
    state.lists.splice(listIndex, 1);
    state.tasks = state.tasks.filter((t) => t.listId !== list.id);
    state.view = state.lists[Math.max(0, listIndex - 1)].id;
    commit();
    toast(`Lista “${list.name}” excluída`, 'Desfazer', () => {
      state.lists.splice(listIndex, 0, list);
      for (const { task, index } of removedTasks) state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
      state.view = list.id;
      commit();
    }, 7000);
  }

  /* ================== Gaveta (mobile) ================== */
  function openDrawer() {
    document.body.classList.add('drawer-open');
    $('#menu-btn').setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    document.body.classList.remove('drawer-open');
    $('#menu-btn').setAttribute('aria-expanded', 'false');
  }

  /* ================== Eventos ================== */
  $('#nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view;
    search = '';
    $('#search').value = '';
    commit();
    closeDrawer();
  });

  $('#new-list-btn').addEventListener('click', () => openListDialog());
  $('#rename-list-btn').addEventListener('click', () => currentList() && openListDialog(state.view));
  $('#delete-list-btn').addEventListener('click', deleteCurrentList);

  els.addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.newTitle.value.trim();
    if (!title) { els.newTitle.focus(); return; }
    addTask(title, els.newDue.value, Number(els.newPriority.value));
    els.newTitle.value = '';
    els.newDue.value = '';
    els.newPriority.value = '0';
    els.newTitle.focus();
  });

  els.tasks.addEventListener('click', (e) => {
    const item = e.target.closest('.task');
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.closest('.check')) toggleTask(id);
    else if (e.target.closest('.task-del')) deleteTasks([id], 'Tarefa excluída');
    else if (e.target.closest('.task-body')) openTaskDialog(id);
  });
  els.tasks.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('task-body')) {
      e.preventDefault();
      openTaskDialog(e.target.closest('.task').dataset.id);
    }
  });

  $('.segmented').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    commit();
  });

  $('#search').addEventListener('input', (e) => { search = e.target.value; renderTasks(); });
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; commit(); });

  els.clearDone.addEventListener('click', () => {
    const ids = tasksInView().filter((t) => t.done).map((t) => t.id);
    if (ids.length) deleteTasks(ids, `${plural(ids.length, 'tarefa removida', 'tarefas removidas')}`);
  });

  els.themeBtn.addEventListener('click', () => {
    state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
    commit();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTheme);

  $('#menu-btn').addEventListener('click', openDrawer);
  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === '/') && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      (e.key === '/' ? $('#search') : els.newTitle).focus();
    }
  });

  // Sincroniza entre abas abertas.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { state = load(); render(); }
  });

  // Atualiza rótulos "Hoje/Amanhã" quando o app volta ao primeiro plano em outro dia.
  let lastDay = localISO();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && localISO() !== lastDay) { lastDay = localISO(); render(); }
  });

  /* ================== Backup ================== */
  $('#export-btn').addEventListener('click', () => {
    const data = JSON.stringify({ app: 'tarefas', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = el('a', { href: url, download: `tarefas-${localISO()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup exportado');
  });

  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isValidState(data)) throw new Error('formato');
      const n = data.tasks.length;
      if (!confirm(`Substituir suas listas atuais pelo backup (${plural(data.lists.length, 'lista', 'listas')}, ${plural(n, 'tarefa', 'tarefas')})?`)) return;
      const previous = state;
      state = sanitize({ ...data, theme: state.theme });
      commit();
      closeDrawer();
      toast('Backup importado', 'Desfazer', () => { state = previous; commit(); }, 8000);
    } catch (err) {
      toast('Arquivo inválido. Escolha um backup exportado por este app.');
    }
  });

  /* ================== Lembretes (notificações push) ==================
   * As tarefas ficam só neste aparelho. Para avisar com o app fechado, enviamos ao
   * servidor (/api/reminders) apenas o título, o nome da lista e o horário de cada
   * lembrete futuro. O cron-job.org chama /api/cron a cada minuto, que dispara o push.
   * O app compara o que deveria estar no servidor com o que já foi enviado e
   * manda só as diferenças — inclusive quando volta a ficar online. */
  const SYNC_KEY = 'tarefas:lembretes';
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let pushConfig; // undefined = ainda não buscado · null = servidor sem notificações
  let syncTimer = 0;
  let syncing = false;
  let syncAgain = false;
  let warnedUnavailable = false;

  function readSynced() {
    try {
      const s = JSON.parse(localStorage.getItem(SYNC_KEY));
      if (s && typeof s === 'object' && s.items) return s;
    } catch (e) { /* ignora */ }
    return { endpoint: '', key: '', items: {} };
  }
  function writeSynced(s) {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(s)); } catch (e) { /* ignora */ }
  }

  function desiredReminders() {
    const now = Date.now();
    const out = {};
    for (const t of state.tasks) {
      if (!t.remindAt || t.done) continue;
      const at = Date.parse(t.remindAt);
      if (at > now) out[t.id] = { at, title: t.title, body: getList(t.listId)?.name || '' };
    }
    return out;
  }

  async function getPushConfig() {
    if (pushConfig !== undefined) return pushConfig;
    let res;
    try { res = await fetch('api/config', { cache: 'no-store' }); } catch (e) { return null; } // offline: tenta depois
    try { pushConfig = res.ok ? await res.json() : null; } catch (e) { pushConfig = null; }
    if (!pushConfig || !pushConfig.vapidPublicKey) pushConfig = null;
    return pushConfig;
  }

  function base64UrlToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function reminderApi(method, payload) {
    const res = await fetch('api/reminders', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`api/reminders ${res.status}`);
  }

  function scheduleReminderSync(delay = 800) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncReminders, delay);
  }

  async function syncReminders() {
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    try {
      const desired = desiredReminders();
      let synced = readSynced();
      const wantsAny = Object.keys(desired).length > 0;
      if (!wantsAny && !Object.keys(synced.items).length) return;
      if (!pushSupported) return;

      const config = await getPushConfig();
      if (!config) {
        if (wantsAny && pushConfig === null && !warnedUnavailable) {
          warnedUnavailable = true;
          toast('Lembretes indisponíveis: o servidor de notificações não está configurado.');
        }
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // Chave do servidor mudou: a inscrição antiga não serve mais.
      if (sub && synced.key && synced.key !== config.vapidPublicKey) {
        await sub.unsubscribe().catch(() => {});
        sub = null;
      }
      if (!sub && wantsAny && Notification.permission === 'granted') {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(config.vapidPublicKey),
        });
      }
      if (!sub) return;
      if (synced.endpoint !== sub.endpoint || synced.key !== config.vapidPublicKey) {
        synced = { endpoint: sub.endpoint, key: config.vapidPublicKey, items: {} };
        writeSynced(synced);
      }

      for (const id of Object.keys(synced.items)) {
        if (desired[id]) continue;
        await reminderApi('DELETE', { endpoint: sub.endpoint, taskId: id });
        delete synced.items[id];
        writeSynced(synced);
      }
      const subscription = sub.toJSON();
      for (const [id, r] of Object.entries(desired)) {
        const prev = synced.items[id];
        if (prev && prev.at === r.at && prev.title === r.title && prev.body === r.body) continue;
        await reminderApi('POST', { subscription, taskId: id, title: r.title, body: r.body, remindAt: r.at });
        synced.items[id] = r;
        writeSynced(synced);
      }
    } catch (err) {
      console.warn('Lembretes: não foi possível sincronizar agora.', err);
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleReminderSync(); }
    }
  }

  async function askNotificationPermission() {
    if (!pushSupported) {
      toast(isIOS
        ? 'No iPhone, adicione o app à Tela de Início para receber lembretes.'
        : 'Este navegador não permite notificações.', null, null, 7000);
      return;
    }
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') {
      toast('As notificações estão bloqueadas nas configurações do navegador.', null, null, 7000);
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') scheduleReminderSync(0);
    else toast('Sem permissão de notificação, o lembrete não será enviado.', null, null, 7000);
  }

  // O pedido de permissão precisa partir de um clique do usuário.
  $('#task-form button[value="save"]').addEventListener('click', () => {
    if (taskForm.elements.remindAt.value) askNotificationPermission();
  });

  window.addEventListener('online', () => scheduleReminderSync(0));

  /* ================== PWA: instalação e service worker ================== */
  let deferredPrompt = null;
  const installBtn = $('#install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    toast('App instalado! 🎉');
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        const offerUpdate = (worker) => {
          toast('Nova versão disponível', 'Atualizar', () => worker.postMessage({ type: 'SKIP_WAITING' }), 0);
        };
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
          });
        });
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return;
          reloading = true;
          location.reload();
        });
      } catch (err) {
        console.warn('Service worker não registrado:', err);
      }
    });
  }

  /* ================== Início ================== */
  // Atalho do app instalado (ex.: ?view=today).
  const startView = new URLSearchParams(location.search).get('view');
  if (startView === 'today' || startView === 'all') {
    state.view = startView;
    history.replaceState(null, '', location.pathname);
  }
  save();
  render();
  scheduleReminderSync(2000);
})();
