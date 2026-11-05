// 지메일에서 메일을 열면 "할 일에 추가" 버튼을 보여 주는 스크립트

const button = document.createElement("button");
button.id = "todo-ext-add";
button.textContent = "+ 할 일에 추가";
button.hidden = true;

const toast = document.createElement("div");
toast.id = "todo-ext-toast";
toast.hidden = true;

document.body.append(button, toast);

// 지금 열려 있는 메일의 제목 (메일 목록 화면이면 null)
function getSubject() {
  const el = document.querySelector("h2.hP");
  if (!el || !el.offsetParent) return null;
  const text = el.textContent.trim();
  return text || null;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2000);
}

button.addEventListener("click", () => {
  const subject = getSubject();
  if (!subject) return;
  const url = location.href;

  chrome.storage.local.get({ todos: [] }, (data) => {
    const todos = data.todos;
    if (todos.some((t) => t.url === url)) {
      showToast("이미 할 일에 있는 메일이에요.");
      return;
    }
    todos.push({ id: Date.now(), text: `[메일] ${subject}`, done: false, url });
    chrome.storage.local.set({ todos }, () => {
      showToast("할 일에 추가했어요.");
    });
  });
});

// 지메일은 페이지 이동 없이 화면이 바뀌므로, 화면이 바뀔 때마다 버튼 표시 여부를 다시 정함
let pending = false;
new MutationObserver(() => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    button.hidden = !getSubject();
  });
}).observe(document.body, { childList: true, subtree: true });
