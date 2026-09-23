(() => {
  // Nav icons are served from icons/, not hotlinked from oldschool.runescape.wiki. This
  // script runs on every page, so each hotlink here was a wiki request on every page view.
  // Paths are relative to the page, and every page lives at the site root.
  const tools = [
    {name:'GE Tracker',group:'Market tool',description:'Watch prices and flips',file:'osrs-ge-tracker.html',icon:'icons/Grand_Exchange_logo.png'},
    {name:'Skill Profits',group:'Market tool',description:'Compare skilling profit',file:'osrs-skill-profit.html',icon:'icons/Coins_10000.png'},
    {name:'Construction',group:'Training planner',description:'Levels, materials, cost',file:'osrs-training-planner.html',icon:'icons/Construction_icon.png'},
    {name:'Farming',group:'Training planner',description:'Runs, patches, inventory',file:'osrs-farming-planner.html',icon:'icons/Farming_icon.png'},
    {name:'Herblore',group:'Training planner',description:'Routes and live costs',file:'osrs-herblore-planner.html',icon:'icons/Herblore_icon.png'},
    {name:'Prayer',group:'Training planner',description:'Methods and bone costs',file:'osrs-prayer-planner.html',icon:'icons/Prayer_icon.png'},
    {name:'Crafting',group:'Training planner',description:'Gems, dragonhide, and more',file:'osrs-crafting-planner.html',icon:'icons/Crafting_icon.png'},
    {name:'Smithing',group:'Training planner',description:'Anvils, Blast Furnace, Foundry',file:'osrs-smithing-planner.html',icon:'icons/Smithing_icon.png'},
    {name:'Cooking',group:'Training planner',description:'Burn-aware routes and locations',file:'osrs-cooking-planner.html',icon:'icons/Cooking_icon.png'},
    {name:'Fletching',group:'Training planner',description:'Bows, darts, and Vale Totems',file:'osrs-fletching-planner.html',icon:'icons/Fletching_icon.png'}
  ];
  const currentFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const currentIndex=tools.findIndex(tool=>tool.file===currentFile);
  if(currentIndex<0) return;
  const current=tools[currentIndex];
  document.body.dataset.suitePage=current.name.toLowerCase().replace(/\s+/g,'-');
  const header=document.querySelector('header');
  const logo=header?.querySelector('.logo');
  if(!header||!logo) return;
  logo.textContent='OSRS Toolbox';
  const groups=['Market tool','Training planner'];
  const menuHtml=groups.map(group=>`<div class="suite-menu-group"><div class="suite-menu-title">${group==='Market tool'?'Market tools':'Training planners'}</div>${tools.filter(tool=>tool.group===group).map(tool=>`<a class="suite-menu-link${tool.file===currentFile?' current':''}" href="${tool.file}"><img src="${tool.icon}" alt=""><strong>${tool.name}</strong><small>${tool.description}</small></a>`).join('')}</div>`).join('');
  const host=document.createElement('div');
  host.className='suite-switcher-host';
  host.innerHTML=`<a class="suite-cycle" href="${tools[(currentIndex-1+tools.length)%tools.length].file}" aria-label="Previous tool: ${tools[(currentIndex-1+tools.length)%tools.length].name}">‹</a><button class="suite-tool-button" type="button" aria-expanded="false" aria-haspopup="menu"><img class="suite-tool-icon" src="${current.icon}" alt=""><span class="suite-tool-copy"><span class="suite-tool-group">${current.group}</span><span class="suite-tool-name">${current.name}</span></span><span class="suite-tool-chevron">▾</span></button><a class="suite-cycle" href="${tools[(currentIndex+1)%tools.length].file}" aria-label="Next tool: ${tools[(currentIndex+1)%tools.length].name}">›</a><div class="suite-tool-menu" role="menu">${menuHtml}</div>`;
  logo.insertAdjacentElement('afterend',host);
  const button=host.querySelector('.suite-tool-button');
  const menu=host.querySelector('.suite-tool-menu');
  const close=()=>{menu.classList.remove('open');button.setAttribute('aria-expanded','false')};
  button.addEventListener('click',event=>{event.stopPropagation();const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open))});
  document.addEventListener('click',event=>{if(!host.contains(event.target))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){close();button.focus()}});

  if(current.name==='Herblore'||current.name==='Crafting'||current.name==='Smithing'||current.name==='Cooking'||current.name==='Fletching'){
    const content=document.querySelector('.content');
    const oldPanel=document.querySelector('.input-panel');
    const speedPanel=document.querySelector('.speed-panel');
    const username=document.getElementById('womUsername');
    const fetchButton=document.getElementById('womFetchBtn');
    const fromInput=document.getElementById('manualLevel');
    const toInput=document.getElementById('targetLevel');
    const xpInput=document.getElementById('manualXp');
    const updateButton=document.getElementById('applyBtn');
    const exactButton=document.getElementById('womToggle');
    const priceStatus=document.getElementById('priceStatus');
    const fetchStatus=document.getElementById('womStatus');
    const statusCard=document.getElementById('statusCard');
    if(content&&oldPanel&&speedPanel&&username&&fetchButton&&fromInput&&toInput&&updateButton){
      const focusedHead=document.createElement('section');
      focusedHead.className='focused-page-head';
      focusedHead.innerHTML=`<div class="focused-title"><span>Training planner</span><h1>${current.name} <b>&middot; <span data-focus-current></span> &rarr; <span data-focus-target></span></b></h1></div><div class="focused-account"></div>`;
      const account=focusedHead.querySelector('.focused-account');
      fetchButton.textContent='Load character';
      account.append(username,fetchButton);

      const levelStrip=document.createElement('section');
      levelStrip.className='focused-level-strip';
      levelStrip.innerHTML=`<label class="focused-level-start"><span>From level</span></label><label class="focused-xp-start"><span>Current ${current.name} XP</span></label><i>&rarr;</i><label><span>To level</span></label>`;
      levelStrip.querySelector('.focused-level-start').append(fromInput);
      levelStrip.querySelector('label:last-of-type').append(toInput);
      updateButton.textContent='Update plan';
      if(xpInput){
        xpInput.classList.add('focused-exact-xp');
        xpInput.disabled=true;
        levelStrip.querySelector('.focused-xp-start').append(xpInput);
      }
      levelStrip.append(updateButton);
      const xpControls=document.createElement('div');
      xpControls.className='focused-xp-controls';
      xpControls.innerHTML='<span>Starting point</span><div class="focused-mode-toggle" role="group" aria-label="Choose starting point"><button type="button" class="active" data-start-mode="level">Level</button><button type="button" data-start-mode="xp">Exact XP</button></div>';
      levelStrip.append(xpControls);
      if(exactButton)exactButton.remove();

      const meta=document.createElement('div');
      meta.className='focused-meta';
      if(priceStatus)meta.append(priceStatus);
      if(fetchStatus)meta.append(fetchStatus);
      if(statusCard){statusCard.classList.add('focused-status-engine');meta.append(statusCard)}

      content.insertBefore(focusedHead,oldPanel);
      focusedHead.insertAdjacentElement('afterend',levelStrip);
      levelStrip.insertAdjacentElement('afterend',meta);
      oldPanel.remove();

      const syncHeading=()=>{
        focusedHead.querySelector('[data-focus-current]').textContent=fromInput.value||'3';
        focusedHead.querySelector('[data-focus-target]').textContent=toInput.value||'99';
      };
      syncHeading();
      fromInput.addEventListener('input',syncHeading);
      toInput.addEventListener('input',syncHeading);
      updateButton.addEventListener('click',()=>setTimeout(syncHeading,0));
      fetchButton.addEventListener('click',()=>setTimeout(syncHeading,700));
      const setStartMode=mode=>{
        const exact=mode==='xp';
        xpControls.querySelectorAll('[data-start-mode]').forEach(button=>button.classList.toggle('active',button.dataset.startMode===mode));
        levelStrip.classList.toggle('show-exact',exact);
        fromInput.disabled=exact;
        if(xpInput){xpInput.disabled=!exact;if(exact)xpInput.focus()}
      };
      xpControls.querySelectorAll('[data-start-mode]').forEach(modeButton=>modeButton.addEventListener('click',()=>setStartMode(modeButton.dataset.startMode)));
      document.addEventListener('herblore:exact-xp',()=>setStartMode('xp'));
      xpInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();updateButton.click()}});
    }
  }
})();
