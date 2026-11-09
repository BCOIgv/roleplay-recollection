const BASE_T = 1793500000000; // 2026-11-01 10:26:40 +08:00
const HOUR = 3600000;
const MIN = 60000;
const DAY = 24 * HOUR;

function makeDistractors(scope, prefix, count, startAt, topics) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const t = startAt + i * 2 * HOUR;
    const topic = topics[i % topics.length](i + 1);
    items.push({
      id: `${prefix}-noise-${String(i + 1).padStart(2, '0')}`,
      scope,
      status: 'active',
      truth: topic.truth ?? 'reported',
      source_kind: topic.kind ?? 'factual',
      ...(topic.storyId ? {storyId: topic.storyId} : {}),
      time: t,
      available_at: t + 10 * MIN,
      text: topic.text,
    });
  }
  return items;
}

export function timelineScenarios() {
  const aud1 = 'synthetic-timeline-audience-1';
  const aud2 = 'synthetic-timeline-audience-2';
  const aud3 = 'synthetic-timeline-audience-3';

  // Timeline 1: Cross-epoch emotional bridge under retrieval crowding (28 memories, 3 episodes x 3 turns)
  const tl1Materials = [
    {
      id: 'tl1-mem-deep-osmanthus-tea',
      scope: aud1,
      status: 'active',
      truth: 'observed',
      source_kind: 'episodic',
      time: BASE_T - 12 * DAY,
      available_at: BASE_T - 12 * DAY + 30 * MIN,
      text: '历史共同经历（类型：episodic 过去记录的对话经历，属于历史过去时）：九月通宵排完BLUE SPACE展板终稿那天，我们泡了一壶热桂花乌龙，放了张老爵士黑胶唱片；你说每次做完大型项目最怕别人追问进度，只想捧着热茶发呆。',
    },
    {
      id: 'tl1-mem-surface-ep1-kickoff',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'episodic',
      time: BASE_T - 2 * HOUR,
      available_at: BASE_T - 90 * MIN,
      text: '历史用户原文（类型：episodic 过去记录的对话经历）：这周开始排烘焙餐厅的室内轴测图和材质球，木饰面和暖光灯带的参数还得慢慢磨。',
    },
    {
      id: 'tl1-mem-surface-ep1-lamp',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'preference',
      time: BASE_T - 3 * HOUR,
      available_at: BASE_T - 2 * HOUR,
      text: '历史用户原文（类型：preference 历史偏好陈述）：工作台边上的暖光小台灯调暗一点比较不刺眼。',
    },
    {
      id: 'tl1-mem-surface-ep1-font',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 4 * HOUR,
      available_at: BASE_T - 3 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：排版标题用了无衬线黑体，图例字号统一设成了8pt。',
    },
    {
      id: 'tl1-mem-surface-ep2-revision',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'episodic',
      time: BASE_T + 3 * DAY - 3 * HOUR,
      available_at: BASE_T + 3 * DAY - 2 * HOUR,
      text: '历史用户原文（类型：episodic 过去记录的对话经历）：今天下午把主视角渲染图又返工了一遍，调色和阴影细节磨得人眼花，只盼着赶紧交完大稿能安静歇口气。',
    },
    {
      id: 'tl1-mem-surface-ep2-coffee',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T + 3 * DAY - 4 * HOUR,
      available_at: BASE_T + 3 * DAY - 3 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：下午点的冰美式放到半夜已经没味道了，喝得胃里有点发凉。',
    },
    {
      id: 'tl1-mem-surface-ep2-rain',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T + 3 * DAY - 5 * HOUR,
      available_at: BASE_T + 3 * DAY - 4 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：天气预报说明天傍晚会有一场小雨，气温要降四五度。',
    },
    {
      id: 'tl1-mem-crowding-01',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 6 * HOUR,
      available_at: BASE_T - 5 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：每次把大图全部打包发出去之前都要核对一遍压缩包文件名和版本号。',
    },
    {
      id: 'tl1-mem-crowding-02',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 5 * HOUR,
      available_at: BASE_T - 4 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：连续画图几个小时肩膀酸得抬不起来，椅子扶手高度还得调一下。',
    },
    {
      id: 'tl1-mem-crowding-03',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 4 * HOUR,
      available_at: BASE_T - 3 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：脑子一直绷着算尺寸的时候最容易漏看图层名字，先把软件关掉重启能清掉不少缓存。',
    },
    {
      id: 'tl1-mem-crowding-04',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 3 * HOUR,
      available_at: BASE_T - 2 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：外面有点阴天飘雨的时候室内光线偏暗，要是现在选一样熟悉的东西缓口气，通常会先调暗屏幕亮度。',
    },
    {
      id: 'tl1-mem-crowding-05',
      scope: aud1,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 2 * HOUR,
      available_at: BASE_T - 90 * MIN,
      text: '历史用户原文（类型：factual 历史背景陈述）：打包发出去的最后几张大图收个尾就能交差，屋里特别安静的时候适合合上笔记本休息。',
    },
    ...makeDistractors(aud1, 'tl1', 16, BASE_T - 4 * DAY, [
      n => ({text: `历史用户原文（类型：factual 历史背景陈述）：第${n}号材料样板收到了，亚麻布纹的触感比预想的粗糙一点。`}),
      n => ({text: `历史用户原文（类型：factual 历史背景陈述）：网盘备份目录整理了第${n}批贴图资产，删掉了重复的法线贴图。`}),
      n => ({text: `历史用户原文（类型：planned 尚未证实兑现的计划）：打算下个月有空把显示器支架往左挪一点（编号${n}）。`, kind: 'planned'}),
      n => ({text: `历史用户原文（类型：preference 历史偏好陈述）：平时整理参考图喜欢按冷暖色调分文件夹（记录${n}）。`, kind: 'preference'}),
    ]),
  ];

  const timeline1 = {
    schema_version: 2,
    dataset_version: 'synthetic-timeline-v2',
    timeline_id: 'cross-epoch-emotional-bridge',
    split: 'development',
    audience: aud1,
    scope_kind: 'private',
    mode: 'companion',
    data_origin: 'synthetic',
    character: {
      id: 'companion-zhixing',
      persona: '温和、细心的日常陪伴角色，说话自然简短，懂得在对方刚忙完时体贴接话，不追问工作进度。',
    },
    materials: tl1Materials,
    episodes: [
      {
        episode_id: 'tl1-ep1',
        episode_index: 1,
        opportunity_at: BASE_T,
        last_recorded_interaction_at: BASE_T - 60 * MIN,
        idle_gap_minutes: 60,
        idle_candidates: {
          surface_ids: ['tl1-mem-surface-ep1-kickoff', 'tl1-mem-surface-ep1-lamp', 'tl1-mem-surface-ep1-font'],
          bridge_id: 'tl1-mem-noise-01',
        },
        recent_context: [
          {id: 'tl1-ctx-1', at: BASE_T - 65 * MIN, role: 'user', text: '今天开始排烘焙餐厅的图了，先去倒杯水。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl1-e1-t1', at: BASE_T + 10 * MIN, role: 'user', text: '回来了，刚把轴测图的底图导出来，线条还算干净。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl1-e1-t2', at: BASE_T + 14 * MIN, role: 'user', text: '木饰面的颜色还在纠结选浅胡桃木还是白橡木。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl1-e1-t3', at: BASE_T + 18 * MIN, role: 'user', text: '先按浅胡桃木试一版灯光，今天不熬太晚了。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl1-ep2',
        episode_index: 2,
        opportunity_at: BASE_T + 3 * DAY,
        last_recorded_interaction_at: BASE_T + 3 * DAY - 90 * MIN,
        idle_gap_minutes: 90,
        idle_candidates: {
          surface_ids: ['tl1-mem-surface-ep2-revision', 'tl1-mem-surface-ep2-coffee', 'tl1-mem-surface-ep2-rain'],
          bridge_id: 'tl1-mem-surface-ep1-kickoff',
        },
        recent_context: [
          {id: 'tl1-ctx-2', at: BASE_T + 3 * DAY - 95 * MIN, role: 'user', text: '下午还得把主视角阴影重跑一遍，冰美式都放凉了。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl1-e2-t1', at: BASE_T + 3 * DAY + 12 * MIN, role: 'user', text: '第二版小样终于跑完了，比昨天顺眼一点。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl1-e2-t2', at: BASE_T + 3 * DAY + 16 * MIN, role: 'user', text: '就是盯屏幕太久眼睛有点干，那杯凉美式喝得胃里怪怪的。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl1-e2-t3', at: BASE_T + 3 * DAY + 20 * MIN, role: 'user', text: '明天把最后几张大图收个尾就能交差了。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl1-ep3',
        episode_index: 3,
        opportunity_at: BASE_T + 6 * DAY,
        last_recorded_interaction_at: BASE_T + 6 * DAY - 80 * MIN,
        idle_gap_minutes: 80,
        idle_candidates: {
          surface_ids: ['tl1-mem-surface-ep2-revision', 'tl1-mem-surface-ep2-coffee', 'tl1-mem-surface-ep2-rain'],
          bridge_id: 'tl1-mem-deep-osmanthus-tea',
        },
        recent_context: [
          {id: 'tl1-ctx-3', at: BASE_T + 6 * DAY - 85 * MIN, role: 'user', text: '正在打最后的压缩包，发完这版终于能喘口气了。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl1-e3-t1', at: BASE_T + 6 * DAY + 10 * MIN, role: 'user', text: '刚把这版大图全部打包发出去了，肩膀酸得抬不起来。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl1-e3-t2', at: BASE_T + 6 * DAY + 15 * MIN, role: 'user', text: '这几天脑子一直绷着算尺寸，现在把软件关掉反而觉得屋里特别安静。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl1-e3-t3', at: BASE_T + 6 * DAY + 20 * MIN, role: 'user', text: '外面又有点阴天飘雨了，要是现在让你选一样熟悉的东西帮我缓口气，你会想到什么？', truth: 'reported'},
          },
        ],
      },
    ],
  };

  // Timeline 2: Multi-gap restraint, cooldown, and anti-repetition (26 memories, 3 episodes x 3 turns)
  const tl2Materials = [
    {
      id: 'tl2-mem-bookshop-cat',
      scope: aud2,
      status: 'active',
      truth: 'observed',
      source_kind: 'episodic',
      time: BASE_T - 3 * DAY,
      available_at: BASE_T - 3 * DAY + 20 * MIN,
      text: '历史共同经历（类型：episodic 过去记录的对话经历，属于历史过去时）：上周末在旧书店挑建筑画册时，门口那只胖橘猫一直趴在你的帆布包上打呼噜，店员最后还送了一张银杏叶手绘书签。',
    },
    {
      id: 'tl2-mem-logistics-courier',
      scope: aud2,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 4 * HOUR,
      available_at: BASE_T - 3 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：快递单号记在备忘录里了，下午顺丰把打印纸放在门口丰巢柜。',
    },
    {
      id: 'tl2-mem-logistics-ink',
      scope: aud2,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 3 * HOUR,
      available_at: BASE_T - 2 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：打印机黑色墨盒还剩两格，月底盘点耗材时再顺手登记。',
    },
    {
      id: 'tl2-mem-logistics-folder',
      scope: aud2,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 2 * HOUR,
      available_at: BASE_T - 90 * MIN,
      text: '历史用户原文（类型：factual 历史背景陈述）：本地归档目录统一按日期加短横线命名，旧临时缓存已经清空。',
    },
    {
      id: 'tl2-mem-logistics-cable',
      scope: aud2,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T + DAY - 3 * HOUR,
      available_at: BASE_T + DAY - 2 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：备用Type-C数据线收在右边第二个抽屉的透明盒子里。',
    },
    ...makeDistractors(aud2, 'tl2', 21, BASE_T - 4 * DAY, [
      n => ({text: `历史用户原文（类型：factual 历史背景陈述）：常规文件归档编号${n}已核对校验和，无需额外处理。`}),
      n => ({text: `历史用户原文（类型：factual 历史背景陈述）：日常桌面清理记录${n}，外设连接正常。`}),
      n => ({text: `历史用户原文（类型：preference 历史偏好陈述）：文档正文字体习惯用思源宋体（记录${n}）。`, kind: 'preference'}),
    ]),
  ];

  const timeline2 = {
    schema_version: 2,
    dataset_version: 'synthetic-timeline-v2',
    timeline_id: 'multi-gap-restraint-and-anti-repeat',
    split: 'development',
    audience: aud2,
    scope_kind: 'private',
    mode: 'companion',
    data_origin: 'synthetic',
    character: {
      id: 'companion-zhixing',
      persona: '克制、安静的日常陪伴角色，有话则短，无事可说时从不强行找话题或反复拿同一件旧事刷存在感。',
    },
    materials: tl2Materials,
    episodes: [
      {
        episode_id: 'tl2-ep1',
        episode_index: 1,
        opportunity_at: BASE_T,
        last_recorded_interaction_at: BASE_T - 55 * MIN,
        idle_gap_minutes: 55,
        idle_candidates: {
          surface_ids: ['tl2-mem-bookshop-cat', 'tl2-mem-logistics-courier', 'tl2-mem-logistics-ink'],
          bridge_id: 'tl2-mem-logistics-folder',
        },
        recent_context: [
          {id: 'tl2-ctx-1', at: BASE_T - 60 * MIN, role: 'user', text: '把书架上的画册理了一遍，准备去热个午饭。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl2-e1-t1', at: BASE_T + 10 * MIN, role: 'user', text: '午饭热好了，顺便把桌上那摞画册按开本大小排整齐了。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl2-e1-t2', at: BASE_T + 14 * MIN, role: 'user', text: '刚才翻画册的时候还看到了夹在里面的那张银杏叶书签。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl2-e1-t3', at: BASE_T + 18 * MIN, role: 'user', text: '吃完我先去取个打印纸快递，下午集中整理电脑文件夹。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl2-ep2',
        episode_index: 2,
        opportunity_at: BASE_T + 2 * HOUR,
        last_recorded_interaction_at: BASE_T + 2 * HOUR - 50 * MIN,
        idle_gap_minutes: 50,
        idle_candidates: {
          surface_ids: ['tl2-mem-bookshop-cat', 'tl2-mem-logistics-courier', 'tl2-mem-logistics-folder'],
          bridge_id: 'tl2-mem-logistics-ink',
        },
        recent_context: [
          {id: 'tl2-ctx-2', at: BASE_T + 70 * MIN, role: 'user', text: '快递拿回来了，休息五十分钟就开始归档本地目录。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl2-e2-t1', at: BASE_T + 2 * HOUR + 10 * MIN, role: 'user', text: '开始建归档目录了，今天下午就专心搞定这批工程文件命名。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl2-e2-t2', at: BASE_T + 2 * HOUR + 15 * MIN, role: 'user', text: '旧的临时缓存我已经全部清掉了，磁盘腾出来二十多个G。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl2-e2-t3', at: BASE_T + 2 * HOUR + 20 * MIN, role: 'user', text: '搞定收工，列表看着清爽多了。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl2-ep3',
        episode_index: 3,
        opportunity_at: BASE_T + 3 * DAY + 2 * HOUR,
        last_recorded_interaction_at: BASE_T + 3 * DAY + 2 * HOUR - 75 * MIN,
        idle_gap_minutes: 75,
        idle_candidates: {
          surface_ids: ['tl2-mem-logistics-courier', 'tl2-mem-logistics-ink', 'tl2-mem-logistics-cable'],
          bridge_id: 'tl2-mem-logistics-folder',
        },
        recent_context: [
          {id: 'tl2-ctx-3', at: BASE_T + 3 * DAY + 2 * HOUR - 80 * MIN, role: 'user', text: '下午核对完耗材表格，没什么特别的事。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl2-e3-t1', at: BASE_T + 3 * DAY + 2 * HOUR + 10 * MIN, role: 'user', text: '刚把备用数据线收进右边抽屉了，今天杂活都处理得差不多了。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl2-e3-t2', at: BASE_T + 3 * DAY + 2 * HOUR + 15 * MIN, role: 'user', text: '打印机的墨盒还剩两格，等月底盘点的时候再一起买就行。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl2-e3-t3', at: BASE_T + 3 * DAY + 2 * HOUR + 20 * MIN, role: 'user', text: '傍晚准备出去散个步，今天难得这么清闲。', truth: 'reported'},
          },
        ],
      },
    ],
  };

  // Timeline 3: Temporal & Modal Boundary Stress (past action vs present action, planned vs completed, hearsay, other-story)
  const tl3Materials = [
    {
      id: 'tl3-mem-past-cup-tap',
      scope: aud3,
      status: 'active',
      truth: 'reported',
      source_kind: 'episodic',
      time: BASE_T - 10 * DAY,
      available_at: BASE_T - 10 * DAY + 30 * MIN,
      text: '历史用户原文（类型：episodic 过去记录的对话经历，属于历史过去时，仅证明用户曾这样说，非当前正在发生的动作）：上个月改方案卡壳那次，我说我以前思考卡住时有个习惯，会拿搪瓷杯在桌沿轻轻敲两下。',
    },
    {
      id: 'tl3-mem-planned-anji-camping',
      scope: aud3,
      status: 'active',
      truth: 'reported',
      source_kind: 'planned',
      time: BASE_T - 4 * DAY,
      available_at: BASE_T - 4 * DAY + 30 * MIN,
      text: '历史用户原文（类型：planned 尚未证实兑现的计划，仅证明用户曾提及该打算，严禁当作已完成事件）：打算等十一月下旬忙完手头的项目，去安吉山里露营看一次秋叶，目前还没订营地也没出发。',
    },
    {
      id: 'tl3-mem-rumor-exhibition',
      scope: aud3,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 2 * DAY,
      available_at: BASE_T - 2 * DAY + 30 * MIN,
      text: '历史用户原文（类型：factual 历史背景陈述，仅为用户转述传闻）：听朋友提了一嘴，城西美术馆的木构建筑展好像可能会延期到月底，不过馆方公众号还没发正式通知。',
    },
    {
      id: 'tl3-mem-other-story-airship',
      scope: aud3,
      status: 'active',
      truth: 'fictional',
      source_kind: 'episodic',
      storyId: 'steampunk-sky-arc',
      time: BASE_T - 6 * DAY,
      available_at: BASE_T - 6 * DAY + 30 * MIN,
      text: '跨故事设定参考（storyId: steampunk-sky-arc）：在蒸汽飞艇甲板上校准黄铜罗盘，穿过云海风暴。',
    },
    {
      id: 'tl3-mem-desk-clean',
      scope: aud3,
      status: 'active',
      truth: 'reported',
      source_kind: 'factual',
      time: BASE_T - 3 * HOUR,
      available_at: BASE_T - 2 * HOUR,
      text: '历史用户原文（类型：factual 历史背景陈述）：今天早上把书桌彻底清空了，桌面上只留了键盘、鼠标和显示器，水杯都拿到厨房洗碗机里去了。',
    },
    ...makeDistractors(aud3, 'tl3', 22, BASE_T - 5 * DAY, [
      n => ({text: `历史用户原文（类型：factual 历史背景陈述）：建筑读书笔记第${n}则，摘录了卒姆托关于材料温度的段落。`}),
      n => ({text: `历史用户原文（类型：preference 历史偏好陈述）：看展览时喜欢拍节点构造细部多过拍全景（记录${n}）。`, kind: 'preference'}),
      n => ({text: `历史用户原文（类型：planned 尚未证实兑现的计划）：计划年底有空把阳台的防腐木地板刷一层木蜡油（计划${n}）。`, kind: 'planned'}),
    ]),
  ];

  const timeline3 = {
    schema_version: 2,
    dataset_version: 'synthetic-timeline-v2',
    timeline_id: 'temporal-and-planned-boundary-stress',
    split: 'heldout',
    audience: aud3,
    scope_kind: 'private',
    mode: 'companion',
    data_origin: 'synthetic',
    character: {
      id: 'companion-zhixing',
      persona: '清醒、自然的日常陪伴角色，严格区分过去习惯与当下现场动作、区分未出发的计划与已完成的经历、区分传闻与定论。',
    },
    materials: tl3Materials,
    episodes: [
      {
        episode_id: 'tl3-ep1',
        episode_index: 1,
        opportunity_at: BASE_T,
        last_recorded_interaction_at: BASE_T - 60 * MIN,
        idle_gap_minutes: 60,
        idle_candidates: {
          surface_ids: ['tl3-mem-desk-clean', 'tl3-mem-past-cup-tap', 'tl3-mem-noise-01'],
          bridge_id: 'tl3-mem-noise-02',
        },
        recent_context: [
          {id: 'tl3-ctx-1', at: BASE_T - 65 * MIN, role: 'user', text: '早上把杯子全塞进洗碗机了，现在书桌上只有键盘和显示器，安静想会儿方案。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl3-e1-t1', at: BASE_T + 10 * MIN, role: 'user', text: '刚才对着屏幕发了二十分钟呆，动线方案还是有两个转角没想通。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl3-e1-t2', at: BASE_T + 14 * MIN, role: 'user', text: '桌面上空荡荡的只有键盘，手都没地方搭，一卡壳就觉得有点烦躁。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl3-e1-t3', at: BASE_T + 18 * MIN, role: 'user', text: '你还记得我以前说过思考卡壳时有什么习惯吗？幸好今天桌上没放杯子。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl3-ep2',
        episode_index: 2,
        opportunity_at: BASE_T + 3 * DAY,
        last_recorded_interaction_at: BASE_T + 3 * DAY - 70 * MIN,
        idle_gap_minutes: 70,
        idle_candidates: {
          surface_ids: ['tl3-mem-planned-anji-camping', 'tl3-mem-noise-03', 'tl3-mem-noise-04'],
          bridge_id: 'tl3-mem-desk-clean',
        },
        recent_context: [
          {id: 'tl3-ctx-2', at: BASE_T + 3 * DAY - 75 * MIN, role: 'user', text: '今天降温挺明显的，不知道这个月能不能按时把手头的活忙完。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl3-e2-t1', at: BASE_T + 3 * DAY + 10 * MIN, role: 'user', text: '看日历已经十一月上旬了，山里的树叶估计快变色了。', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl3-e2-t2', at: BASE_T + 3 * DAY + 15 * MIN, role: 'user', text: '之前提过等十一月下旬忙完想去哪儿透透气来着？现在连营地都还没顾上看。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl3-e2-t3', at: BASE_T + 3 * DAY + 20 * MIN, role: 'user', text: '希望下旬别临时加需求，能让我把这个计划兑现了。', truth: 'reported'},
          },
        ],
      },
      {
        episode_id: 'tl3-ep3',
        episode_index: 3,
        opportunity_at: BASE_T + 6 * DAY,
        last_recorded_interaction_at: BASE_T + 6 * DAY - 80 * MIN,
        idle_gap_minutes: 80,
        idle_candidates: {
          surface_ids: ['tl3-mem-rumor-exhibition', 'tl3-mem-other-story-airship', 'tl3-mem-noise-02'],
          bridge_id: 'tl3-mem-planned-anji-camping',
        },
        recent_context: [
          {id: 'tl3-ctx-3', at: BASE_T + 6 * DAY - 85 * MIN, role: 'user', text: '周末想在市区找个建筑展看看，放松下眼睛。', truth: 'reported'},
        ],
        dialogue_turns: [
          {
            turn_index: 1,
            user_message: {id: 'tl3-e3-t1', at: BASE_T + 6 * DAY + 10 * MIN, role: 'user', text: '说到看展，城西美术馆那个木构建筑展你记得有什么消息吗？', truth: 'reported'},
          },
          {
            turn_index: 2,
            user_message: {id: 'tl3-e3-t2', at: BASE_T + 6 * DAY + 15 * MIN, role: 'user', text: '对，我先去翻翻他们公众号有没有发正式通知，省得白跑一趟。', truth: 'reported'},
          },
          {
            turn_index: 3,
            user_message: {id: 'tl3-e3-t3', at: BASE_T + 6 * DAY + 20 * MIN, role: 'user', text: '要是真去成了，我多拍几张榫卯节点的细部回来。', truth: 'reported'},
          },
        ],
      },
    ],
  };

  return [timeline1, timeline2, timeline3];
}
