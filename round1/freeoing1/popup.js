"use strict";

const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const addButton = document.querySelector("#add-button");
const list = document.querySelector("#todo-list");
const remaining = document.querySelector("#remaining");
const empty = document.querySelector("#empty");
const message = document.querySelector("#message");
let todos = [];
let ready = false;
let saving = false;

function render() {
  list.replaceChildren();
  remaining.textContent = `남은 할 일 ${todos.filter(todo => !todo.done).length}개`;
  empty.hidden = todos.length > 0;
  for (const todo of todos) {
    const row = document.createElement("li");
    row.classList.toggle("done", todo.done);
    const label = document.createElement("label");
    label.className = "task-label";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = todo.done;
    check.disabled = saving;
    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = todo.text;
    label.append(check, text);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", `${todo.text} 삭제`);
    remove.disabled = saving;
    check.addEventListener("change", () => {
      commit(todos.map(item => item.id === todo.id ? { ...item, done: check.checked } : item), () => {
        list.querySelectorAll('input[type="checkbox"]')[todos.findIndex(item => item.id === todo.id)]?.focus();
      });
    });
    remove.addEventListener("click", () => {
      const index = todos.findIndex(item => item.id === todo.id);
      commit(todos.filter(item => item.id !== todo.id), () => {
        const buttons = list.querySelectorAll(".delete-button");
        (buttons[Math.min(index, buttons.length - 1)] || input).focus();
      });
    });
    row.append(label, remove);
    list.append(row);
  }
}

async function commit(next, onSuccess) {
  if (!ready || saving) return;
  saving = true;
  addButton.disabled = true;
  input.disabled = true;
  list.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
  message.textContent = "";
  let succeeded = false;
  try {
    await chrome.storage.local.set({ todos: next });
    todos = next;
    succeeded = true;
  } catch {
    message.textContent = "저장하지 못했어요. 다시 시도해 주세요.";
  } finally {
    saving = false;
    input.disabled = false;
    addButton.disabled = false;
    render();
  }
  if (succeeded) onSuccess?.();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!ready || saving) return;
  const text = input.value.trim();
  if (!text) {
    message.textContent = "할 일을 입력해 주세요.";
    input.focus();
    return;
  }
  commit([...todos, { id: crypto.randomUUID(), text, done: false }], () => {
    input.value = "";
    input.focus();
  });
});

async function initialize() {
  try {
    const stored = await chrome.storage.local.get({ todos: [] });
    todos = Array.isArray(stored.todos) ? stored.todos.filter(todo =>
      todo && typeof todo.id === "string" && typeof todo.text === "string" && todo.text.trim()
    ).map(todo => ({ id: todo.id, text: todo.text, done: todo.done === true })) : [];
    ready = true;
    input.disabled = false;
    addButton.disabled = false;
    render();
    input.focus();
  } catch {
    remaining.textContent = "불러오기 실패";
    message.textContent = "목록을 불러오지 못했어요. 창을 다시 열어 주세요.";
  }
}

initialize();
