(() => {
  const $ = id => document.getElementById(id);
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const intVal=(el,fallback=0)=>{const n=parseInt(el.value,10);return Number.isFinite(n)?n:fallback};

  const els = {
    themeColor:$("themeColor"),
    ability:$("ability"), bonusDice:$("bonusDice"), target:$("target"), favored:$("favored"),
    crit:$("crit"), fumble:$("fumble"), memo:$("memo"),
    equipDice:$("equipDice"), equipTarget:$("equipTarget"), equipMemo:$("equipMemo"),
    giftDice:$("giftDice"), giftTarget:$("giftTarget"), giftMemo:$("giftMemo"),
    itemDice:$("itemDice"), itemTarget:$("itemTarget"), itemMemo:$("itemMemo"),
    otherDice:$("otherDice"), otherTarget:$("otherTarget"), otherMemo:$("otherMemo"),
    commandOutput:$("commandOutput"), copyCommand:$("copyCommand"),
    resetBuilder:$("resetBuilder"),
    logInput:$("logInput"), analyzeButton:$("analyzeButton"), clearLog:$("clearLog"),
    analyzeEmpty:$("analyzeEmpty"), analyzeResult:$("analyzeResult"),
    actualDegree:$("actualDegree"), metrics:$("metrics"), diceEditor:$("diceEditor"),
    calculation:$("calculation"), judge:$("judge"), differenceBox:$("differenceBox"),
    editTarget:$("editTarget"), editCrit:$("editCrit"), editFumble:$("editFumble"), superSuccess:$("superSuccess"),
    resetEdits:$("resetEdits"), presetMagician:$("presetMagician"), judgementValueTarget:$("judgementValueTarget"),
    applyMinusOne:$("applyMinusOne"), setSelectedValue:$("setSelectedValue"), selectedValueInput:$("selectedValueInput"),
    mpChargeSummary:$("mpChargeSummary"), mpChargeDice:$("mpChargeDice"), clearMpCharge:$("clearMpCharge"),
    finalResultText:$("finalResultText"), copyFinalResult:$("copyFinalResult")
  };

  const THEME_STORAGE_KEY="wow-display-theme";
  const THEMES=["default","dark","simple"];
  const THEME_COLORS={default:"#73d0eb",dark:"#081626",simple:"#ececec"};
  const LIMIT_GUMS={
    none:{label:"",critDelta:0,fumbleDelta:0,numerator:1,denominator:1,fraction:""},
    "60":{label:"60%リミットガム",critDelta:-1,fumbleDelta:1,numerator:2,denominator:3,fraction:"2/3"},
    "50":{label:"50%リミットガム",critDelta:-1,fumbleDelta:1,numerator:1,denominator:2,fraction:"1/2"}
  };
  const themeButtons=[...document.querySelectorAll("[data-theme-option]")];
  const limitGumRadios=[...document.querySelectorAll("[data-limit-gum]")];

  function getLimitGum(value){return LIMIT_GUMS[value]||LIMIT_GUMS.none}

  function applyTheme(requestedTheme,persist=false){
    const theme=THEMES.includes(requestedTheme)?requestedTheme:"default";
    document.documentElement.dataset.theme=theme;
    els.themeColor.setAttribute("content",THEME_COLORS[theme]);
    themeButtons.forEach(button=>{
      const selected=button.dataset.themeOption===theme;
      button.setAttribute("aria-pressed",selected?"true":"false");
    });
    if(persist){
      try{localStorage.setItem(THEME_STORAGE_KEY,theme)}catch{}
    }
  }

  function loadTheme(){
    try{return localStorage.getItem(THEME_STORAGE_KEY)||"default"}catch{return"default"}
  }

  let state = null;

  function buildCommand(){
    const ability=clamp(intVal(els.ability,0),0,99);
    const bonus=clamp(intVal(els.bonusDice,0),-99,99);
    const target=clamp(intVal(els.target,6),1,12);
    const crit=clamp(intVal(els.crit,1),1,12);
    const fumble=clamp(intVal(els.fumble,12),1,12);

    const categories = [
      ["装備", intVal(els.equipDice,0), intVal(els.equipTarget,0), els.equipMemo.value.trim()],
      ["ギフト", intVal(els.giftDice,0), intVal(els.giftTarget,0), els.giftMemo.value.trim()],
      ["アイテム", intVal(els.itemDice,0), intVal(els.itemTarget,0), els.itemMemo.value.trim()],
      ["その他", intVal(els.otherDice,0), intVal(els.otherTarget,0), els.otherMemo.value.trim()]
    ];

    let diceExpr=`${ability}`;
    if(bonus>0)diceExpr+=`+${bonus}`; else if(bonus<0)diceExpr+=`${bonus}`;
    let targetExpr=`${target}`;
    if(els.favored.checked)targetExpr+="+1";

    categories.forEach(([_,d,t])=>{
      if(d>0)diceExpr+=`+${d}`; else if(d<0)diceExpr+=`${d}`;
      if(t>0)targetExpr+=`+${t}`; else if(t<0)targetExpr+=`${t}`;
    });

    const notes=categories.filter(([,d,t,m])=>d!==0||t!==0||m).map(([name,d,t,m])=>{
      const bits=[]; if(m)bits.push(m);
      if(d!==0)bits.push(`ダイス${d>0?"+":""}${d}`);
      if(t!==0)bits.push(`目標値${t>0?"+":""}${t}`);
      return `${name}:${bits.join("/")}`;
    });
    const freeMemo=els.memo.value.trim(); if(freeMemo)notes.unshift(freeMemo);

    const core=`(${diceExpr})WW12@${crit}#${fumble}<=(${targetExpr})`;
    els.commandOutput.textContent=notes.length?`${core}　${notes.join("　")}`:core;
  }

  function legacyCopy(text){
    const area=document.createElement("textarea");
    area.value=text;
    area.setAttribute("readonly","");
    area.style.position="fixed";
    area.style.opacity="0";
    area.style.pointerEvents="none";
    document.body.appendChild(area);
    area.select();
    let copied=false;
    try{copied=Boolean(document.execCommand&&document.execCommand("copy"))}catch{}
    area.remove();
    return copied;
  }

  async function copyText(text,button){
    let copied=false;
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        copied=true;
      }
    }catch{}
    if(!copied)copied=legacyCopy(text);
    if(!copied){prompt("コピーしてください：",text);return}
    const old=button.textContent;button.textContent="コピー済み";
    setTimeout(()=>button.textContent=old,1100);
  }

  function parseLog(text){
    const normalized=String(text)
      .replace(/[＞]/g,">").replace(/[＜]/g,"<").replace(/[＝]/g,"=")
      .replace(/[＠]/g,"@").replace(/[＃]/g,"#").replace(/[，]/g,",");
    const matches=[...normalized.matchAll(/(\d+)\s*WW12(?:@(\d+))?(?:#(\d+))?\s*<=\s*(-?\d+)/gi)];
    if(!matches.length)throw new Error("WW12 の実行式を見つけられませんでした。");
    const m=matches[matches.length-1];
    const diceCount=parseInt(m[1],10),crit=m[2]?parseInt(m[2],10):1,fumble=m[3]?parseInt(m[3],10):12,target=parseInt(m[4],10);
    const after=normalized.slice(m.index+m[0].length);
    const diceMatch=after.match(/\[([0-9,\s]+)\]/);
    if(!diceMatch)throw new Error("ダイス結果の [ ... ] を見つけられませんでした。");
    const rolls=diceMatch[1].split(",").map(s=>parseInt(s.trim(),10)).filter(Number.isFinite);
    if(!rolls.length)throw new Error("ダイス結果を読み取れませんでした。");
    if(rolls.some(value=>value<1||value>12))throw new Error("D12の出目は1～12である必要があります。");
    if(rolls.length!==diceCount)throw new Error(`ダイス数が一致しません（式 ${diceCount}個 / 出目 ${rolls.length}個）。`);
    const resultTail=after.slice(diceMatch.index+diceMatch[0].length);
    const shown=resultTail.match(/成功数\s*(\d+)/);
    return {diceCount,crit,fumble,target,rolls,shownSuccess:shown?parseInt(shown[1],10):null};
  }

  function evaluateCurrent(mpCharged=state.mpCharged){
    const limitGum=getLimitGum(state.limitGum);
    const data={
      target:state.target,
      crit:state.crit+limitGum.critDelta,
      fumble:state.fumble+limitGum.fumbleDelta,
      rolls:state.currentRolls
    };
    const dice=data.rolls.map((value,index)=>{
      const isMpCharged=mpCharged.has(index);
      const isFumble=!isMpCharged&&value>=data.fumble;
      const isCrit=!isMpCharged&&!isFumble&&value<=data.crit;
      const isNormalSuccess=!isMpCharged&&!isFumble&&!isCrit&&value<=data.target;
      return {value,index,isMpCharged,isFumble,isCrit,isNormalSuccess,cancelled:false};
    });
    const activeDice=dice.filter(d=>!d.isMpCharged);
    const chargedDice=dice.filter(d=>d.isMpCharged);
    const crits=activeDice.filter(d=>d.isCrit), fumbles=activeDice.filter(d=>d.isFumble);
    const cancelCount=Math.min(crits.length,fumbles.length);
    for(let i=0;i<cancelCount;i++){crits[i].cancelled=true;fumbles[i].cancelled=true}
    const survivingCrits=crits.filter(d=>!d.cancelled).length;
    const survivingFumbles=fumbles.filter(d=>!d.cancelled).length;
    const normalSuccesses=activeDice.filter(d=>d.isNormalSuccess).length;
    const critValue=state.superSuccess?3:2;
    const rawDegree=normalSuccesses+survivingCrits*critValue;

    // WoWファンブル：
    // 大成功と大失敗を相殺した後、大失敗が1個でも残ればファンブル。
    // 成功度は0（失敗）として扱う。
    const isFumble=survivingFumbles>0;
    const degree=isFumble?0:Math.floor(rawDegree*limitGum.numerator/limitGum.denominator);

    return {
      ...data,dice,
      critCount:crits.length,
      fumbleCount:fumbles.length,
      cancelCount,
      survivingCrits,
      survivingFumbles,
      normalSuccesses,
      critValue,
      superSuccess:state.superSuccess,
      limitGum:state.limitGum,
      limitGumLabel:limitGum.label,
      limitGumFraction:limitGum.fraction,
      activeDice,
      chargedDice,
      activeRolls:activeDice.map(d=>d.value),
      mpChargeCount:chargedDice.length,
      rawDegree,
      isFumble,
      degree
    };
  }

  function dieClass(d){
    if(d.isMpCharged)return"mp-charged";
    if(d.cancelled)return"cancelled";
    if(d.isFumble)return"fumble";
    if(d.isCrit)return"crit";
    if(d.isNormalSuccess)return"success";
    return"";
  }

  function dieResultLabel(d){
    if(d.isFumble)return"大失敗";
    if(d.isCrit)return"大成功";
    if(d.isNormalSuccess)return"通常成功";
    return"失敗";
  }

  function render(){
    if(!state)return;
    const r=evaluateCurrent();
    const beforeMpCharge=state.mpCharged.size?evaluateCurrent(new Set()):r;
    els.actualDegree.textContent=r.degree;
    els.editTarget.value=r.target;els.editCrit.value=r.crit;els.editFumble.value=r.fumble;
    els.superSuccess.checked=state.superSuccess;
    limitGumRadios.forEach(radio=>radio.checked=radio.dataset.limitGum===state.limitGum);

    const metrics=[
      ...(r.mpChargeCount
        ?[`振ったダイス ${state.currentRolls.length}個`,`判定使用 ${r.activeDice.length}個`,`MPチャージ ${r.mpChargeCount}点`]
        :[`ダイス ${state.currentRolls.length}個`]),
      `目標値 ${r.target}`,`大成功 ≤${r.crit}`,
      `大失敗 ≥${r.fumble}`,`通常成功 ${r.normalSuccesses}`,`大成功 ${r.critCount}`,
      `大失敗 ${r.fumbleCount}`,`相殺 ${r.cancelCount}組`,
      ...(state.superSuccess?[`超成功 ON（大成功×3）`]:[]),
      ...(state.limitGum!=="none"?[`${r.limitGumLabel} ON（成功度×${r.limitGumFraction}・切り捨て）`]:[]),
      ...(r.survivingFumbles>0?[`残存大失敗 ${r.survivingFumbles}`]:[])
    ];
    els.metrics.innerHTML=metrics.map(x=>`<span class="metric">${x}</span>`).join("");

    els.diceEditor.innerHTML="";
    r.dice.forEach(d=>{
      const btn=document.createElement("button");
      btn.type="button";
      const changed=state.currentRolls[d.index]!==state.originalRolls[d.index];
      const detail=[d.isMpCharged?"MP+1":"",changed?`元:${state.originalRolls[d.index]}`:""].filter(Boolean).join(" / ");
      btn.className=`edit-die ${dieClass(d)} ${state.selected.has(d.index)?"selected":""} ${changed?"changed":""}`;
      btn.setAttribute("aria-pressed",state.selected.has(d.index)?"true":"false");
      btn.setAttribute("aria-label",`${d.index+1}個目のダイス、出目${d.value}${d.isMpCharged?"、MPチャージで判定から除外中":""}${changed?`、元の出目${state.originalRolls[d.index]}`:""}`);
      btn.innerHTML=`<span class="value">${d.value}</span><span class="original">${detail}</span>`;
      btn.title="クリックで選択";
      btn.addEventListener("click",()=>{
        if(state.selected.has(d.index))state.selected.delete(d.index);else state.selected.add(d.index);
        render();
      });
      els.diceEditor.appendChild(btn);
    });

    els.clearMpCharge.disabled=r.mpChargeCount===0;
    els.mpChargeSummary.textContent=r.mpChargeCount
      ?`MPチャージ ${r.mpChargeCount}点 ／ 除外 ${r.mpChargeCount}個 ／ 成功度 ${beforeMpCharge.degree} → ${r.degree}`
      :"MPチャージする出目を選択してください。";
    els.mpChargeDice.innerHTML="";
    beforeMpCharge.dice.forEach(d=>{
      const charged=state.mpCharged.has(d.index);
      const btn=document.createElement("button");
      btn.type="button";
      btn.className=`mp-charge-die ${charged?"is-charged":""}`;
      btn.setAttribute("aria-pressed",charged?"true":"false");
      btn.setAttribute("aria-label",`${d.index+1}個目のダイス、出目${d.value}、${dieResultLabel(d)}。${charged?"MPチャージで判定から除外中。押すと解除":"押すとMPチャージに使用"}`);
      btn.innerHTML=`<span class="value">${d.value}</span><span class="state">${charged?"MP +1":"選択"}</span>`;
      btn.title=charged?"クリックでMPチャージを解除":"クリックでMPチャージに使用";
      btn.addEventListener("click",()=>{
        if(state.mpCharged.has(d.index))state.mpCharged.delete(d.index);else state.mpCharged.add(d.index);
        state.selected.delete(d.index);
        render();
      });
      els.mpChargeDice.appendChild(btn);
    });

    if(r.isFumble){
      const chargePrefix=r.mpChargeCount?`MPチャージ除外後[${r.activeRolls.join(",")}]：`:"";
      els.calculation.textContent=`${chargePrefix}大成功と大失敗を相殺後、大失敗が${r.survivingFumbles}個残存 → 成功度0`;
      els.judge.textContent="ファンブル";
      els.judge.style.color="var(--red)";
    }else{
      const chargePrefix=r.mpChargeCount?`MPチャージ除外後[${r.activeRolls.join(",")}]：`:"";
      const baseCalculation=`${chargePrefix}${r.normalSuccesses}+${r.survivingCrits}×${r.critValue} = ${r.rawDegree}${state.superSuccess?"（超成功）":""}`;
      els.calculation.textContent=state.limitGum==="none"
        ?baseCalculation
        :`${baseCalculation} → ${r.limitGumLabel}：${r.rawDegree}×${r.limitGumFraction} = ${r.degree}（切り捨て）`;
      els.judge.textContent=r.degree>=1?"成功":"失敗";
      els.judge.style.color=r.degree>=1?"var(--teal)":"var(--red)";
    }

    const changedCount=state.currentRolls.filter((v,i)=>v!==state.originalRolls[i]).length;
    const thresholdChanged=r.target!==state.original.target||r.crit!==state.original.crit||r.fumble!==state.original.fumble||state.superSuccess!==state.original.superSuccess;
    const limitGumChanged=state.limitGum!=="none";
    const mpChargeChanged=r.mpChargeCount>0;

    if(changedCount||thresholdChanged||limitGumChanged||mpChargeChanged){
      const limitGumNotice=limitGumChanged?`／${r.limitGumLabel}適用`:"";
      const mpChargeNotice=mpChargeChanged?`／MPチャージ${r.mpChargeCount}点`:"";
      els.differenceBox.textContent=r.isFumble
        ?`変更反映済み：出目変更 ${changedCount}個${thresholdChanged?"／判定値変更あり":""}${limitGumNotice}${mpChargeNotice}。相殺後も大失敗が残っているためファンブル、成功度0です。`
        :`変更反映済み：出目変更 ${changedCount}個${thresholdChanged?"／判定値変更あり":""}${limitGumNotice}${mpChargeNotice}。現在の成功度は ${r.degree} です。`;
    }else if(state.shownSuccess==null){
      els.differenceBox.textContent="ココフォリア側の「成功数」は取得できませんでしたが、再計算は完了しています。";
    }else{
      if(r.isFumble){
        els.differenceBox.textContent=`ココフォリア表示の「成功数」は ${state.shownSuccess}。WoWルールでは相殺後に大失敗が残るためファンブルとなり、成功度0です。`;
      }else{
        const diff=r.degree-state.shownSuccess;
        els.differenceBox.textContent=diff===0
          ?`ココフォリア表示の成功数 ${state.shownSuccess} と、WoWルールでの成功度は同じです。`
          :`ココフォリア表示の「成功数」は ${state.shownSuccess}。WoWルールで数え直すと「成功度 ${r.degree}」です（差 ${diff>0?"+":""}${diff}）。`;
      }
    }

    const changes=[];
    state.currentRolls.forEach((v,i)=>{if(v!==state.originalRolls[i])changes.push(`${state.originalRolls[i]}→${v}`)});
    if(r.target!==state.original.target)changes.push(`目標値 ${state.original.target}→${r.target}`);
    if(r.crit!==state.original.crit)changes.push(`大成功値 ${state.original.crit}→${r.crit}`);
    if(r.fumble!==state.original.fumble)changes.push(`大失敗値 ${state.original.fumble}→${r.fumble}`);
    if(state.superSuccess!==state.original.superSuccess)changes.push(state.superSuccess?"超成功ON":"超成功OFF");
    const changeText=changes.length?` / 変更: ${changes.join(", ")}`:"";
    const limitGumText=state.limitGum==="none"?"":` / 効果:${r.limitGumLabel}（成功度×${r.limitGumFraction}・切り捨て、適用前${r.rawDegree}）`;
    const mpChargeDiceText=r.chargedDice.map(d=>`${d.index+1}個目:${d.value}`).join(",");
    const rollText=r.mpChargeCount
      ?`判定出目[${r.activeRolls.join(",")}] / MPチャージ${r.mpChargeCount}点（除外[${mpChargeDiceText}]） / 全出目[${state.currentRolls.join(",")}]`
      :`出目[${state.currentRolls.join(",")}]`;
    const statusText=r.isFumble?"ファンブル":(r.degree>=1?"成功":"失敗");
    els.finalResultText.textContent=`【WoW確定結果】${statusText} / 成功度${r.degree} / ${rollText} / 目標値${r.target} / 大成功≤${r.crit}${state.superSuccess?"（超成功:1個=3）":""} / 大失敗≥${r.fumble}${limitGumText}${changeText}`;
  }

  function startAnalysis(parsed){
    state={
      originalRolls:[...parsed.rolls],
      currentRolls:[...parsed.rolls],
      target:parsed.target,crit:parsed.crit,fumble:parsed.fumble,superSuccess:false,limitGum:"none",
      original:{target:parsed.target,crit:parsed.crit,fumble:parsed.fumble,superSuccess:false},
      shownSuccess:parsed.shownSuccess,
      selected:new Set(),
      mpCharged:new Set()
    };
    els.analyzeEmpty.classList.add("hidden");
    els.analyzeResult.classList.remove("hidden");
    render();
  }

  function showError(msg){
    state=null;els.analyzeResult.classList.add("hidden");els.analyzeEmpty.classList.remove("hidden");
    els.analyzeEmpty.textContent=`読み取りできませんでした：${msg}`;
  }

  function syncThresholds(){
    if(!state)return;
    const limitGum=getLimitGum(state.limitGum);
    state.target=intVal(els.editTarget,state.target);
    state.crit=intVal(els.editCrit,state.crit+limitGum.critDelta)-limitGum.critDelta;
    state.fumble=intVal(els.editFumble,state.fumble+limitGum.fumbleDelta)-limitGum.fumbleDelta;
    render();
  }

  [els.ability,els.bonusDice,els.target,els.favored,els.crit,els.fumble,els.memo,
   els.equipDice,els.equipTarget,els.equipMemo,els.giftDice,els.giftTarget,els.giftMemo,
   els.itemDice,els.itemTarget,els.itemMemo,els.otherDice,els.otherTarget,els.otherMemo]
   .forEach(el=>el.addEventListener("input",buildCommand));

  [
    [els.ability,0,99,0],[els.bonusDice,-99,99,0],[els.target,1,12,6],
    [els.crit,1,12,1],[els.fumble,1,12,12]
  ].forEach(([el,min,max,fallback])=>el.addEventListener("change",()=>{
    el.value=clamp(intVal(el,fallback),min,max);
    buildCommand();
  }));

  els.copyCommand.addEventListener("click",()=>copyText(els.commandOutput.textContent,els.copyCommand));
  els.resetBuilder.addEventListener("click",()=>{
    els.ability.value=4;els.bonusDice.value=0;els.target.value=6;els.favored.checked=false;els.crit.value=1;els.fumble.value=12;els.memo.value="";
    [els.equipDice,els.equipTarget,els.giftDice,els.giftTarget,els.itemDice,els.itemTarget,els.otherDice,els.otherTarget].forEach(el=>el.value=0);
    [els.equipMemo,els.giftMemo,els.itemMemo,els.otherMemo].forEach(el=>el.value="");
    buildCommand();
  });

  els.analyzeButton.addEventListener("click",()=>{try{startAnalysis(parseLog(els.logInput.value))}catch(e){showError(e.message)}});
  els.clearLog.addEventListener("click",()=>{
    state=null;els.logInput.value="";els.analyzeResult.classList.add("hidden");els.analyzeEmpty.classList.remove("hidden");
    els.analyzeEmpty.textContent="ログを貼ると、ここに再計算結果が出ます。";
  });

  [els.editTarget,els.editCrit,els.editFumble].forEach(el=>el.addEventListener("input",syncThresholds));
  els.superSuccess.addEventListener("change",()=>{
    if(!state)return;
    state.superSuccess=els.superSuccess.checked;
    render();
  });
  limitGumRadios.forEach(radio=>radio.addEventListener("change",()=>{
    if(!state||!radio.checked)return;
    state.limitGum=LIMIT_GUMS[radio.dataset.limitGum]?radio.dataset.limitGum:"none";
    render();
  }));
  els.selectedValueInput.addEventListener("input",()=>{
    const v=parseInt(els.selectedValueInput.value,10);
    if(Number.isFinite(v)){
      if(v<1) els.selectedValueInput.value=1;
      if(v>12) els.selectedValueInput.value=12;
    }
  });
  document.querySelectorAll("[data-threshold]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!state)return;
    const key=btn.dataset.threshold,delta=parseInt(btn.dataset.delta,10);
    state[key]+=delta;render();
  }));

  els.applyMinusOne.addEventListener("click",()=>{
    if(!state||!state.selected.size){alert("変更するダイスを選択してください。");return}
    state.selected.forEach(i=>state.currentRolls[i]=Math.max(1,state.currentRolls[i]-1));
    render();
  });

  els.setSelectedValue.addEventListener("click",()=>{
    if(!state||!state.selected.size){alert("変更するダイスを選択してください。");return}
    const v=parseInt(els.selectedValueInput.value,10);
    if(!Number.isFinite(v)||v<1||v>12){
      alert("1～12で入力してください。");
      els.selectedValueInput.focus();
      return;
    }
    state.selected.forEach(i=>state.currentRolls[i]=v);
    state.selected.clear();
    render();
  });

  els.presetMagician.addEventListener("click",()=>{
    if(!state)return;
    const key=els.judgementValueTarget.value;
    if(!["target","crit","fumble"].includes(key))return;
    state[key]+=1;
    render();
  });

  els.clearMpCharge.addEventListener("click",()=>{
    if(!state||!state.mpCharged.size)return;
    state.mpCharged.clear();
    render();
  });

  els.resetEdits.addEventListener("click",()=>{
    if(!state)return;
    state.currentRolls=[...state.originalRolls];
    state.target=state.original.target;state.crit=state.original.crit;state.fumble=state.original.fumble;state.superSuccess=state.original.superSuccess;state.limitGum="none";
    state.selected.clear();state.mpCharged.clear();render();
  });

  els.copyFinalResult.addEventListener("click",()=>copyText(els.finalResultText.textContent,els.copyFinalResult));

  themeButtons.forEach(button=>button.addEventListener("click",()=>{
    applyTheme(button.dataset.themeOption,true);
  }));

  applyTheme(loadTheme());
  buildCommand();
})();
