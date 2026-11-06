import {GlobalMemoryLibrary,GlobalRecollection,initializeMemorySources} from 'roleplay-recollection';

export async function applyGlobal(ctx,config,services=ctx.recollection) {
  if(!services||!['resolveAccess','authorize','contextKey'].every(k=>typeof services[k]==='function'))throw new Error('Global memory requires trusted host recollection services: resolveAccess, authorize, contextKey');
  const {sources,stateDir,setupTimeoutMs,...settings}=config;
  if(!stateDir)throw new Error('Global memory requires a separate runtime stateDir');
  const initialized=await initializeMemorySources({sources:sources??await services.listMemorySources(),model:services.setupModel,configDirectory:stateDir,timeoutMs:setupTimeoutMs??30000});
  const library=new GlobalMemoryLibrary({sources:initialized.sources,authorize:services.authorize,unavailableSources:initialized.results.filter(r=>r.status!=='active')});
  const core=new GlobalRecollection({...settings,stateDir,mode:settings.mode??'companion',characterId:settings.characterId??'default'},
    {library,contextKey:services.contextKey,reflect:services.reflect,wander:services.wander});
  const context=args=>({...args,mode:core.config.mode,storyId:core.config.storyId});
  const authorize=async(exec,purpose)=>{
    const access=await services.resolveAccess(exec);
    if(!access||await services.authorize({context:access,purpose,sourceId:null})!==true)throw new Error('Memory access denied');
    return access;
  };
  const properties={cue:{type:'string'},opportunityId:{type:'string'},allowExpression:{type:'boolean'},busy:{type:'boolean'},hasPendingWork:{type:'boolean'},userAwaitingReply:{type:'boolean'},lastInteractionAt:{type:'integer'},lastUserReplyAt:{type:'integer'},delivery:{type:'string',enum:['reply','proactive']},replyToMessageId:{type:'string'}};
  const definitions=[];
  const add=(suffix,description,props,execute,required=[])=>definitions.push({name:'roleplay_recollection_'+suffix,description,parameters:{type:'object',properties:props,required,additionalProperties:false},output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute});
  add('status','Administrator setup and runtime status.',{},async(_a,e)=>{await authorize(e,'admin');return {...core.status(),setup:initialized.results};});
  add('global_search','Search all registered memory sources as administrator.',{query:{type:'string'},cursor:{type:'string'},limit:{type:'integer'}},async(a,e)=>library.query({...a,context:await authorize(e,'admin')}));
  add('visible','Global memory material filtered for the authenticated audience.',properties,async(a,e)=>core.visible(context({...a,trigger:a.cue?'cue':'idle'}),{access:await authorize(e,'rp')}));
  add('recollect','Recall globally available material.',properties,async(a,e)=>core.recollect(context({...a,trigger:'cue'}),{access:await authorize(e,'rp'),signal:e?.signal}),['cue','opportunityId']);
  add('solitude','Run an eligible global solitude opportunity.',properties,async(a,e)=>core.solitude(context(a),{access:await authorize(e,'rp'),signal:e?.signal}));
  add('private_thoughts','Read still-authorized thoughts for this audience.',{},async(a,e)=>({thoughts:await core.privateThoughts(context(a),{access:await authorize(e,'rp')})}));
  add('take_expression','Take a still-valid candidate without sending it.',{...properties,id:{type:'string'}},async(a,e)=>({candidate:await core.takeExpression(a.id,context(a),{access:await authorize(e,'rp')})}),['id']);
  add('settle_expression','Record the verified delivery result.',{id:{type:'string'},outcome:{type:'string',enum:['sent','used_in_reply','unknown','not_sent']},receipt:{type:'string'}},async(a,e)=>core.settleExpression(a.id,a,{access:await authorize(e,'rp')}),['id','outcome']);
  add('pause','Administrator pause/resume.',{value:{type:'boolean'}},async(a,e)=>{await authorize(e,'admin');return core.pause(a.value??true);});
  ctx.effect(()=>{
    const disposers=[];
    try {for(const d of definitions)disposers.push(ctx.tools.register(d));}
    catch(error){for(const dispose of disposers)dispose();void core.close();throw error;}
    return ()=>{for(const dispose of disposers)dispose();void core.close();};
  });
}
