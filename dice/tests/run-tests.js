"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.resolve(__dirname, "..", "script.js");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  add(...names) {
    names.forEach(name => this.names.add(name));
  }

  remove(...names) {
    names.forEach(name => this.names.delete(name));
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.value = "";
    this.checked = false;
    this.textContent = "";
    this.className = "";
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = new Map();
    this.focused = false;
    this.attributes = new Map();
    this._innerHTML = "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const actualEvent = typeof event === "string" ? { type: event } : event;
    actualEvent.target = actualEvent.target || this;
    actualEvent.currentTarget = this;
    for (const listener of this.listeners.get(actualEvent.type) || []) {
      listener.call(this, actualEvent);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  select() {}

  remove() {}

  focus() {
    this.focused = true;
  }
}

class FakeLocalStorage {
  constructor(initialValues = {}) {
    this.values = new Map(
      Object.entries(initialValues).map(([key, value]) => [String(key), String(value)])
    );
  }

  getItem(key) {
    const normalizedKey = String(key);
    return this.values.has(normalizedKey) ? this.values.get(normalizedKey) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  clear() {
    this.values.clear();
  }
}

class FakeDocument {
  constructor(options = {}) {
    this.elements = new Map();
    this.thresholdButtons = [];
    this.themeButtons = [];
    this.documentElement = new FakeElement("html");
    this.documentElement.dataset.theme = "default";
    this.body = new FakeElement("body");
    this.execCommandCalls = [];
    this.execCommandResult = Boolean(options.execCommandResult);

    const themeColor = new FakeElement("meta");
    themeColor.setAttribute("content", "#73d0eb");
    this.elements.set("themeColor", themeColor);

    for (const theme of ["default", "dark", "simple"]) {
      const button = new FakeElement("button");
      button.dataset.themeOption = theme;
      button.setAttribute("aria-pressed", theme === "default" ? "true" : "false");
      this.themeButtons.push(button);
    }

    for (const key of ["target", "crit", "fumble"]) {
      for (const delta of [-1, 1]) {
        const button = new FakeElement("button");
        button.dataset.threshold = key;
        button.dataset.delta = String(delta);
        this.thresholdButtons.push(button);
      }
    }
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      this.elements.set(id, new FakeElement());
    }
    return this.elements.get(id);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelectorAll(selector) {
    if (selector === "[data-threshold]") return this.thresholdButtons;
    if (selector === "[data-theme-option]") return this.themeButtons;
    return [];
  }

  execCommand(command) {
    this.execCommandCalls.push(command);
    return this.execCommandResult;
  }
}

function createApp(options = {}) {
  const document = new FakeDocument(options);
  const localStorage = options.localStorage || new FakeLocalStorage(options.storageValues);
  const alerts = [];
  const prompts = [];
  const defaults = {
    ability: "4",
    bonusDice: "0",
    target: "6",
    crit: "1",
    fumble: "12",
    memo: "",
    equipDice: "0",
    equipTarget: "0",
    equipMemo: "",
    giftDice: "0",
    giftTarget: "0",
    giftMemo: "",
    itemDice: "0",
    itemTarget: "0",
    itemMemo: "",
    otherDice: "0",
    otherTarget: "0",
    otherMemo: "",
    selectedValueInput: "1",
    judgementValueTarget: "target"
  };

  for (const [id, value] of Object.entries(defaults)) {
    document.getElementById(id).value = value;
  }
  document.getElementById("favored").checked = false;
  document.getElementById("superSuccess").checked = false;
  document.getElementById("analyzeResult").classList.add("hidden");

  const context = {
    document,
    localStorage,
    navigator: {
      clipboard: options.clipboard === false ? null : {
        writeText: async () => {}
      }
    },
    alert: message => alerts.push(String(message)),
    prompt: (...args) => {
      prompts.push(args);
      return null;
    },
    setTimeout: callback => {
      callback();
      return 0;
    },
    clearTimeout: () => {},
    console
  };

  vm.createContext(context);
  vm.runInContext(scriptSource, context, { filename: scriptPath });

  return {
    document,
    alerts,
    prompts,
    localStorage,
    el: id => document.getElementById(id),
    themeButton: theme => document.themeButtons.find(
      button => button.dataset.themeOption === theme
    ),
    thresholdButton: (key, delta) => document.thresholdButtons.find(
      button => button.dataset.threshold === key && Number(button.dataset.delta) === delta
    )
  };
}

function fire(element, type) {
  element.dispatchEvent({ type });
}

function analyze(app, log) {
  app.el("logInput").value = log;
  app.el("analyzeButton").click();
}

function degree(app) {
  return Number(app.el("actualDegree").textContent);
}

function selectDie(app, index) {
  const button = app.el("diceEditor").children[index];
  assert.ok(button, `出目 ${index + 1} のボタンが存在すること`);
  button.click();
}

function assertRejectedLog(log) {
  const app = createApp();
  analyze(app, log);
  assert.equal(app.el("analyzeResult").classList.contains("hidden"), true);
  assert.match(String(app.el("analyzeEmpty").textContent), /読み取りできませんでした/);
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test("指定サンプルを成功度6・相殺1組として再計算する", () => {
  const app = createApp();
  analyze(app, [
    "(7+1+4)WW12<=(6+1+1)　交戦",
    "(12WW12<=8) ＞ [9,8,11,5,8,2,11,3,6,1,11,12] ＞ 成功数6（大成功1個、大失敗1個）"
  ].join("\n"));

  assert.equal(degree(app), 6);
  assert.equal(app.el("judge").textContent, "成功");
  assert.match(app.el("metrics").innerHTML, /相殺 1組/);
});

test("通常成功だけを目標値以下で数える", () => {
  const app = createApp();
  analyze(app, "(3WW12<=6) > [2,6,7] > 成功数2");
  assert.equal(degree(app), 2);
  assert.equal(app.el("judge").textContent, "成功");
});

test("大成功は目標値を超えても成功度+2とする", () => {
  const app = createApp();
  analyze(app, "(1WW12@2#12<=1) > [2] > 成功数1");
  assert.equal(degree(app), 2);
  assert.match(app.el("calculation").textContent, /0\+1×2 = 2/);
});

test("大成功と大失敗が同数なら相殺後はファンブルにしない", () => {
  const app = createApp();
  analyze(app, "(2WW12<=6) > [1,12] > 成功数1");
  assert.equal(degree(app), 0);
  assert.equal(app.el("judge").textContent, "失敗");
});

test("相殺後に大失敗が残れば他の成功を無視してファンブルにする", () => {
  const app = createApp();
  analyze(app, "(4WW12<=6) > [1,2,12,12] > 成功数2");
  assert.equal(degree(app), 0);
  assert.equal(app.el("judge").textContent, "ファンブル");
});

test("超成功は相殺後の大成功を1個+3として数える", () => {
  const app = createApp();
  analyze(app, "(2WW12<=6) > [1,2] > 成功数2");
  app.el("superSuccess").checked = true;
  fire(app.el("superSuccess"), "change");

  assert.equal(degree(app), 4);
  assert.match(app.el("calculation").textContent, /×3 = 4/);
  assert.match(app.el("finalResultText").textContent, /超成功/);
});

test("超成功中でも大失敗が残れば成功度0とする", () => {
  const app = createApp();
  analyze(app, "(3WW12<=6) > [1,12,12] > 成功数1");
  app.el("superSuccess").checked = true;
  fire(app.el("superSuccess"), "change");

  assert.equal(degree(app), 0);
  assert.equal(app.el("judge").textContent, "ファンブル");
});

test("大成功値と大失敗値が重なる出目は大失敗を優先する", () => {
  const app = createApp();
  analyze(app, "(1WW12@6#5<=6) > [5] > 成功数1");
  assert.equal(degree(app), 0);
  assert.equal(app.el("judge").textContent, "ファンブル");
});

test("複数選択した出目の-1と下限1を反映する", () => {
  const app = createApp();
  analyze(app, "(2WW12<=6) > [2,3] > 成功数2");
  selectDie(app, 0);
  selectDie(app, 1);
  app.el("applyMinusOne").click();
  app.el("applyMinusOne").click();

  assert.match(app.el("finalResultText").textContent, /出目\[1,1\]/);
  assert.equal(degree(app), 4);
});

test("選択出目の直接変更後に再計算し、変更履歴を出力する", () => {
  const app = createApp();
  analyze(app, "(2WW12<=6) > [12,3] > 成功数1");
  selectDie(app, 0);
  app.el("selectedValueInput").value = "3";
  app.el("setSelectedValue").click();

  assert.equal(degree(app), 2);
  assert.equal(app.el("judge").textContent, "成功");
  assert.match(app.el("finalResultText").textContent, /変更: 12→3/);
});

test("判定値入力とステッパーの変更で即時再計算する", () => {
  const app = createApp();
  analyze(app, "(1WW12<=6) > [8] > 成功数0");

  app.el("editTarget").value = "7";
  fire(app.el("editTarget"), "input");
  assert.equal(degree(app), 0);

  app.thresholdButton("target", 1).click();
  assert.equal(degree(app), 1);
  assert.match(app.el("finalResultText").textContent, /目標値8/);
});

test("「判定値 +1」の選択対象 target/crit/fumble をそれぞれ反映する", () => {
  const targetApp = createApp();
  analyze(targetApp, "(1WW12<=6) > [7] > 成功数0");
  targetApp.el("judgementValueTarget").value = "target";
  targetApp.el("presetMagician").click();
  assert.equal(degree(targetApp), 1);
  assert.match(targetApp.el("finalResultText").textContent, /目標値 6→7/);

  const critApp = createApp();
  analyze(critApp, "(1WW12@1#12<=1) > [2] > 成功数0");
  critApp.el("judgementValueTarget").value = "crit";
  critApp.el("presetMagician").click();
  assert.equal(degree(critApp), 2);
  assert.match(critApp.el("finalResultText").textContent, /大成功値 1→2/);

  const fumbleApp = createApp();
  analyze(fumbleApp, "(1WW12@1#11<=1) > [11] > 成功数0");
  fumbleApp.el("judgementValueTarget").value = "fumble";
  fumbleApp.el("presetMagician").click();
  assert.equal(fumbleApp.el("judge").textContent, "失敗");
  assert.match(fumbleApp.el("finalResultText").textContent, /大失敗値 11→12/);

  assert.equal(targetApp.prompts.length + critApp.prompts.length + fumbleApp.prompts.length, 0);
});

test("負の目標値を含む実行ログを解析する", () => {
  const app = createApp();
  analyze(app, "(1WW12<=-2) > [6] > 成功数0");

  assert.equal(degree(app), 0);
  assert.equal(Number(app.el("editTarget").value), -2);
  assert.equal(app.el("judge").textContent, "失敗");
});

test("判定値 +1 は12を超える値にも加算する", () => {
  const targetApp = createApp();
  analyze(targetApp, "(1WW12<=13) > [2] > 成功数1");
  targetApp.el("judgementValueTarget").value = "target";
  targetApp.el("presetMagician").click();
  assert.match(targetApp.el("finalResultText").textContent, /目標値 13→14/);

  const fumbleApp = createApp();
  analyze(fumbleApp, "(1WW12@1#12<=12) > [12] > 成功数0");
  fumbleApp.el("judgementValueTarget").value = "fumble";
  fumbleApp.el("presetMagician").click();
  assert.equal(degree(fumbleApp), 1);
  assert.match(fumbleApp.el("finalResultText").textContent, /大失敗値 12→13/);
});

test("「変更をすべて戻す」で出目・判定値・超成功・選択を復元する", () => {
  const app = createApp();
  analyze(app, "(2WW12<=6) > [2,12] > 成功数1");
  selectDie(app, 1);
  app.el("selectedValueInput").value = "3";
  app.el("setSelectedValue").click();
  app.el("editTarget").value = "7";
  fire(app.el("editTarget"), "input");
  app.el("superSuccess").checked = true;
  fire(app.el("superSuccess"), "change");

  app.el("resetEdits").click();

  assert.equal(degree(app), 0);
  assert.equal(app.el("judge").textContent, "ファンブル");
  assert.equal(app.el("superSuccess").checked, false);
  assert.match(app.el("finalResultText").textContent, /出目\[2,12\].*目標値6/);
  assert.doesNotMatch(app.el("finalResultText").textContent, /変更:/);

  app.el("applyMinusOne").click();
  assert.match(app.alerts.at(-1), /変更するダイスを選択/);
});

test("複数ログでは最後の判定の出目と成功数を組み合わせる", () => {
  const app = createApp();
  analyze(app, [
    "(2WW12<=6) > [2,3] > 成功数2",
    "(1WW12<=6) > [9] > 成功数0"
  ].join("\n"));

  assert.equal(degree(app), 0);
  assert.match(app.el("differenceBox").textContent, /成功数[^0-9]*0/);
});

test("D12の範囲外の出目を含むログを拒否する", () => {
  assertRejectedLog("(2WW12<=6) > [1,13] > 成功数1");
});

test("宣言ダイス数と出目数が一致しないログを拒否する", () => {
  assertRejectedLog("(3WW12<=6) > [1,2] > 成功数2");
});

test("チャパレ式に得意分野・補正・非標準判定値を保持する", () => {
  const app = createApp();
  app.el("ability").value = "7";
  app.el("bonusDice").value = "1";
  app.el("target").value = "6";
  app.el("favored").checked = true;
  app.el("crit").value = "2";
  app.el("fumble").value = "11";
  app.el("equipDice").value = "4";
  app.el("giftTarget").value = "1";
  app.el("memo").value = "交戦";
  fire(app.el("memo"), "input");

  assert.equal(
    app.el("commandOutput").textContent,
    "(7+1+4)WW12@2#11<=(6+1+1)　交戦　装備:ダイス+4　ギフト:目標値+1"
  );
});

test("チャパレ基本入力の範囲外値を表示と式で一致させる", () => {
  const app = createApp();
  const values = {
    ability: "100",
    bonusDice: "100",
    target: "0",
    crit: "13",
    fumble: "0"
  };

  for (const [id, value] of Object.entries(values)) {
    app.el(id).value = value;
    fire(app.el(id), "change");
  }

  assert.equal(app.el("ability").value, 99);
  assert.equal(app.el("bonusDice").value, 99);
  assert.equal(app.el("target").value, 1);
  assert.equal(app.el("crit").value, 12);
  assert.equal(app.el("fumble").value, 1);
  assert.equal(app.el("commandOutput").textContent, "(99+99)WW12@12#1<=(1)");

  app.el("plusDie").click();
  assert.equal(app.el("bonusDice").value, 99);
});

test("クリップボードAPIが使えない場合はローカルコピー手段へフォールバックする", () => {
  const legacyApp = createApp({ clipboard: false, execCommandResult: true });
  legacyApp.el("copyCommand").click();
  assert.deepEqual(legacyApp.document.execCommandCalls, ["copy"]);
  assert.equal(legacyApp.prompts.length, 0);

  const manualApp = createApp({ clipboard: false, execCommandResult: false });
  manualApp.el("copyCommand").click();
  assert.deepEqual(manualApp.document.execCommandCalls, ["copy"]);
  assert.equal(manualApp.prompts.length, 1);
  assert.equal(manualApp.prompts[0][1], manualApp.el("commandOutput").textContent);
});

test("保存済みテーマがない初回起動では通常モードを選択する", () => {
  const app = createApp();

  assert.equal(app.document.documentElement.dataset.theme, "default");
  assert.equal(app.themeButton("default").getAttribute("aria-pressed"), "true");
  assert.equal(app.themeButton("dark").getAttribute("aria-pressed"), "false");
  assert.equal(app.themeButton("simple").getAttribute("aria-pressed"), "false");
  assert.equal(app.el("themeColor").getAttribute("content"), "#73d0eb");
  assert.equal(app.localStorage.getItem("wow-display-theme"), null);
});

test("ダークモードとシンプルモードの表示状態・メタ色・保存値を切り替える", () => {
  const app = createApp();

  app.themeButton("dark").click();
  assert.equal(app.document.documentElement.dataset.theme, "dark");
  assert.equal(app.themeButton("default").getAttribute("aria-pressed"), "false");
  assert.equal(app.themeButton("dark").getAttribute("aria-pressed"), "true");
  assert.equal(app.themeButton("simple").getAttribute("aria-pressed"), "false");
  assert.equal(app.el("themeColor").getAttribute("content"), "#081626");
  assert.equal(app.localStorage.getItem("wow-display-theme"), "dark");

  app.themeButton("simple").click();
  assert.equal(app.document.documentElement.dataset.theme, "simple");
  assert.equal(app.themeButton("default").getAttribute("aria-pressed"), "false");
  assert.equal(app.themeButton("dark").getAttribute("aria-pressed"), "false");
  assert.equal(app.themeButton("simple").getAttribute("aria-pressed"), "true");
  assert.equal(app.el("themeColor").getAttribute("content"), "#ececec");
  assert.equal(app.localStorage.getItem("wow-display-theme"), "simple");
});

test("保存した表示モードを再起動時に復元する", () => {
  const localStorage = new FakeLocalStorage();
  const firstApp = createApp({ localStorage });
  firstApp.themeButton("dark").click();

  const restartedApp = createApp({ localStorage });
  assert.equal(restartedApp.document.documentElement.dataset.theme, "dark");
  assert.equal(restartedApp.themeButton("dark").getAttribute("aria-pressed"), "true");
  assert.equal(restartedApp.el("themeColor").getAttribute("content"), "#081626");
});

test("不正な保存テーマは通常モードへフォールバックする", () => {
  const app = createApp({
    storageValues: { "wow-display-theme": "unknown-theme" }
  });

  assert.equal(app.document.documentElement.dataset.theme, "default");
  assert.equal(app.themeButton("default").getAttribute("aria-pressed"), "true");
  assert.equal(app.themeButton("dark").getAttribute("aria-pressed"), "false");
  assert.equal(app.themeButton("simple").getAttribute("aria-pressed"), "false");
  assert.equal(app.el("themeColor").getAttribute("content"), "#73d0eb");
});

let passed = 0;
const failures = [];

for (const { name, callback } of tests) {
  try {
    callback();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error.stack || error);
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);

if (failures.length) {
  process.exitCode = 1;
}
