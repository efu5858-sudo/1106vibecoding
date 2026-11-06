const STORAGE_KEY = "todos";
const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const error = document.querySelector("#input-error");
const list = document.querySelector("#todo-list");
const remaining = document.querySelector("#remaining");
const emptyMessage = document.querySelector("#empty-message");
const progress = document.querySelector("#progress");
const progressLabel = document.querySelector("#progress-label");
const addButton = form.querySelector("button");
const closeButton = document.querySelector("#close-panel");
const garden = document.querySelector("#garden");
const gardenTitle = document.querySelector("#garden-title");
const gardenMessage = document.querySelector("#garden-message");
const gardenCount = document.querySelector("#garden-count");
const gardenStages = [
  ["시작을 기다리는 씨앗", "할 일 하나를 끝내면 싹이 나요."],
  ["작은 새싹이 돋았어요", "첫 완료! 작은 시작이 싹을 틔웠어요."],
  ["잎이 무럭무럭 자라요", "두 번째 완료! 초록빛이 더해졌어요."],
  ["한 뼘 더 자랐어요", "세 번째 완료! 꽃을 향해 자라고 있어요."],
  ["꽃봉오리가 맺혔어요", "이제 하나만 더! 곧 꽃이 피어요."],
  ["나만의 꽃이 피었어요", "차곡차곡 쌓인 실천이 꽃이 되었어요."]
];
let todos = [];
let busy = true;
addButton.disabled = true;

if (window.parent !== window) {
  document.body.classList.add("embedded");
  closeButton.hidden = false;
  const closePanel = () => window.parent.postMessage({ type: "daily-focus:close" }, "*");
  closeButton.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });
}

function normalizeTodos(value) {
  return Array.isArray(value) ? value.filter((todo) =>
    todo && typeof todo.id === "string" && typeof todo.text === "string"
  ) : [];
}

async function commit(nextTodos) {
  if (busy) return false;
  busy = true;
  addButton.disabled = true;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: nextTodos });
    todos = nextTodos;
    error.textContent = "";
    return true;
  } catch {
    error.textContent = "저장하지 못했습니다. 다시 시도해 주세요.";
    return false;
  } finally {
    busy = false;
    addButton.disabled = false;
    render();
  }
}

function render() {
  list.replaceChildren();
  for (const todo of todos) {
    const item = document.createElement("li");
    item.className = `todo-item${todo.completed ? " completed" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(todo.completed);
    checkbox.setAttribute("aria-label", `${todo.text} 완료 표시`);
    checkbox.addEventListener("change", async () => {
      const completed = checkbox.checked;
      await commit(todos.map((entry) => entry.id === todo.id ? { ...entry, completed } : entry));
    });
    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `${todo.text} 삭제`);
    deleteButton.addEventListener("click", () => commit(todos.filter((entry) => entry.id !== todo.id)));
    item.append(checkbox, text, deleteButton);
    list.append(item);
  }
  const count = todos.filter((todo) => !todo.completed).length;
  remaining.textContent = `남은 할 일 ${count}개`;
  progress.max = todos.length || 1;
  progress.value = todos.length - count;
  progressLabel.textContent = `${todos.length - count} / ${todos.length} 완료`;
  renderGarden(todos.length - count);
  emptyMessage.hidden = todos.length > 0;
}

function renderGarden(completedCount) {
  const stage = Math.min(completedCount, gardenStages.length - 1);
  garden.dataset.stage = String(stage);
  gardenTitle.textContent = gardenStages[stage][0];
  gardenMessage.textContent = gardenStages[stage][1];
  gardenCount.textContent = `완료 ${completedCount}개 · ${stage === 5 ? "꽃이 활짝 피었어요" : "5개 달성하면 꽃이 피어요"}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const text = input.value.trim();
  if (!text) {
    error.textContent = "할 일을 입력해 주세요.";
    input.focus();
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  if (await commit([{ id, text, completed: false }, ...todos])) {
    input.value = "";
    input.focus();
  }
});
input.addEventListener("input", () => {
  if (input.value.trim()) error.textContent = "";
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    todos = normalizeTodos(changes[STORAGE_KEY].newValue);
    render();
  }
});
chrome.storage.local.get(STORAGE_KEY).then((stored) => {
  todos = normalizeTodos(stored[STORAGE_KEY]);
  busy = false;
  addButton.disabled = false;
  render();
}).catch(() => {
  error.textContent = "목록을 불러오지 못했습니다. 다시 열어 주세요.";
});
