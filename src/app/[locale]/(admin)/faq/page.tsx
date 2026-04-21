import { setRequestLocale, getTranslations } from "next-intl/server";

type FaqSection = {
  title: string;
  items: Array<{ q: string; a: React.ReactNode }>;
};

const faqZh: FaqSection[] = [
  {
    title: "潜客发现",
    items: [
      {
        q: "系统每次运行能找到多少个潜在客户？",
        a: (
          <>
            <p>取决于多个因素,典型范围 <b>3–15 个真实发送</b>(在 dailyCap=10 的设置下)。</p>
            <p className="mt-2">完整漏斗:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              <li>Google Places 单次搜索最多返回 <b>20</b> 家商户</li>
              <li>每家抓 <b>contactsPerCompany</b>(默认 3)个候选邮箱 → 最多 60 个候选</li>
              <li>Hunter/Snov 成功找到邮箱:小型本地商家约 <b>30–50%</b></li>
              <li>邮箱验证通过(分数 ≥ 70):约 <b>60–70%</b></li>
              <li>AI 打分 ≥ 60(行业匹配):约 <b>40–60%</b></li>
              <li>最后被 dailyCap 截断</li>
            </ul>
            <p className="mt-2">
              粗算:dailyCap=10 → 通常 5–15 发出;dailyCap=5 → 通常 3–8 发出。想扩量,先加 dailyCap,别急着加
              contactsPerCompany(后者会快速烧 Hunter 额度)
            </p>
          </>
        ),
      },
      {
        q: "为什么跑完了 0 个潜客？",
        a: (
          <>
            <p>按以下顺序排查:</p>
            <ol className="mt-1 list-decimal pl-5 space-y-0.5">
              <li>Campaign 是否 <code>active</code>?<code>draft</code> 状态 cron 不会跑</li>
              <li>ICP 城市 / 行业是否太冷门?换个覆盖面更广的城市试试</li>
              <li>看 <code>events</code> 表 kind=<code>company.skipped</code>,看是 no_website / all_contacts_known / 还是其他</li>
              <li>Hunter / Snov 配额是否用完?dashboard 的配额卡片会显示</li>
            </ol>
          </>
        ),
      },
      {
        q: "同一家公司会被反复打扰吗？",
        a: "不会。系统按 email 做主键去重 + 按域名缓存 enrichment。同一域名下的 8 家分店,共享 1 次邮箱查找调用。已发过的 prospect 在之后的运行里会被跳过,事件日志标记 already_in_list。",
      },
    ],
  },
  {
    title: "推荐使用流程",
    items: [
      {
        q: "第一次使用,应该怎么走？",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              <b>建 Campaign</b> — 选一个具体行业(tattoo / beauty / restaurant),写清 ICP 描述(目标城市、角色、排除关键词),dailyCap 从 <b>5</b> 起步
            </li>
            <li>
              <b>先预演</b> 10 条 — 审每条草稿:AI 的 fit 分数和推理合不合理?邮件口吻对不对?有没有胡编客户信息?
            </li>
            <li>
              <b>调 prompt / ICP</b> — 发现问题回去改 <code>content/prompts/{"{vertical}"}/first-touch.md</code> 里的规则或者 campaign 的 ICP 描述
            </li>
            <li>
              <b>再预演</b> 5 条 — 确认修改有效
            </li>
            <li>
              <b>手动发送</b> 前 3 封 — 去 prospect 详情页一封封点 "立即发送",观察 Brevo 是否到达、是否被标 spam
            </li>
            <li>
              <b>激活 campaign</b> 走 cron — 观察 48 小时的 open / reply 率
            </li>
            <li>
              <b>慢慢放量</b> — 每 3 天把 dailyCap 加 5(warmup),直到稳定在你的目标值
            </li>
          </ol>
        ),
      },
      {
        q: "日常维护,该看什么？",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>每天</b>:Dashboard 扫一眼 — sent / replies / 配额 / cron 状态</li>
            <li><b>每 2–3 天</b>:replies 收件箱,人工分类回复(意向 / 询价 / 退订)</li>
            <li><b>每周</b>:看 events 里 <code>prospect.skipped</code> 的原因分布,调 ICP</li>
            <li><b>每月</b>:审 prompt 模板,看有没有消息开头雷同、签名是否需要更新</li>
            <li><b>每月</b>:检查 suppressions 列表是否需要清理</li>
          </ul>
        ),
      },
      {
        q: "什么时候该升级或扩量？",
        a: (
          <>
            <p>关键信号:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              <li><b>回复率稳定 ≥ 3%</b> 超过 2 周 → 可以把 dailyCap 翻倍</li>
              <li><b>Brevo 300/日 用满</b> 连续一周 → 升级 Brevo 付费版解锁 inbound webhook</li>
              <li><b>Hunter 搜索剩余 &lt; 20%</b> → 升级 Hunter Starter</li>
              <li><b>回复率 &lt; 1%</b> 超过 2 周 → 别扩量,先改 prompt 和 ICP</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "发送与送达",
    items: [
      {
        q: "为什么运行了但一封邮件都没发出去？",
        a: (
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>Campaign 是 <code>draft</code> 还是 <code>active</code>?</li>
            <li>Brevo DNS(SPF / DKIM / DMARC)配好了吗?没配好邮件会被拒收</li>
            <li>dailyCap 是不是已经跑满了?Dashboard 看 "今日已发送"</li>
            <li>mode 是不是 <code>preview</code>?预演只生成草稿不发</li>
            <li>所有潜客是不是都被低分 / 已存在 / suppression 过滤了?看 events 表</li>
          </ol>
        ),
      },
      {
        q: "为什么每日上限 dailyCap 存在？",
        a: "反垃圾邮件反制 + 保护发件人声誉。Gmail / Outlook 对冷启动发件人非常敏感,一次发太多很容易触发 spam 过滤。dailyCap + 每日增量(WARMUP_DAILY_INCREMENT)模拟人工节奏,新域名 2–3 周内逐步爬坡到 100/日,之后可以稳定在 80–300/日。",
      },
      {
        q: "发出去的邮件被标 spam 了怎么办？",
        a: (
          <ul className="list-disc pl-5 space-y-0.5">
            <li>检查 DMARC 报告(rua 邮箱):看哪些收件方拒收</li>
            <li>暂停 campaign,让送达率恢复</li>
            <li>改 prompt,让邮件更个人化、更短、更少营销词(sample pack / discount 等都可疑)</li>
            <li>手动发 5 封给熟人邮箱,让他们 "Mark as not spam"</li>
            <li>考虑换到独立子域(<code>outreach.usproglove.us</code>)保护主域名</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: "成本与配额",
    items: [
      {
        q: "每发 100 封邮件大概多少钱？",
        a: (
          <>
            <p>当前 Phase 1 配置:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              <li><b>AI token</b>:每封约 $0.002(Haiku 打分 + Sonnet 起草)→ 100 封 ≈ <b>$0.20</b></li>
              <li><b>Google Places</b>:Text Search $5/千次,每封约 0.3 次搜索 → 100 封 ≈ <b>$0.15</b>(被 Google $200/月免费额度覆盖)</li>
              <li><b>Hunter</b>:免费额度内不花钱</li>
              <li><b>Snov</b>:免费额度内不花钱</li>
              <li><b>Brevo</b>:免费 300/日,发 100 封 $0</li>
            </ul>
            <p className="mt-2">合计:<b>每 100 封邮件约 $0.20–0.35 真金白银</b>(大头是 AI token)</p>
          </>
        ),
      },
      {
        q: "配额用完后会怎样？",
        a: "每个服务商不一样。Brevo 满 300/日 → 当天停发,第二天零点重置。Hunter/Snov 月度耗尽 → enrichment 返回空,prospects 被跳过(不是报错)。Google Places 超免费额度 → 开始收费,不会中断。系统设计是 fail-gracefully,不会整个 pipeline 因为一个配额挂掉。",
      },
    ],
  },
  {
    title: "故障与排查",
    items: [
      {
        q: "AI 打分永远低于 60,怎么办？",
        a: "多半是 ICP 描述跟实际目标不匹配,或者 prompt 里的 rubric 太严。去 campaign 编辑页看 ICP 文本是不是太窄,或者改 MIN_FIT_SCORE 环境变量临时放宽到 50 看数据。",
      },
      {
        q: "怎么临时暂停一个 campaign？",
        a: "去 /campaigns 点那条改 status 为 paused。cron 下次就不跑了,已经在发的那批会跑完当前这一次(workflow 不中途打断)。",
      },
      {
        q: "怎么手动把一个邮箱拉黑？",
        a: (
          <>
            进 <code>suppressions</code> 表 INSERT 一条:
            <pre className="mt-2 text-xs bg-neutral-100 dark:bg-neutral-900 p-2 rounded overflow-x-auto">
              INSERT INTO suppressions (email, reason) VALUES (&apos;bad@example.com&apos;, &apos;manual&apos;);
            </pre>
            之后所有 campaign 都会跳过这个地址
          </>
        ),
      },
      {
        q: "回复了但没自动入库？",
        a: "Reply-poll cron 跑每 15 分钟一次,检查 IMAP 邮箱。如果 REPLY_IMAP_* 环境变量没配置,poller 直接退出。Phase 1 可以先人工看 jay.lin@usproglove.us 收件箱,Phase 1.5 再接 IMAP。",
      },
    ],
  },
];

const faqEn: FaqSection[] = [
  {
    title: "Prospecting",
    items: [
      {
        q: "How many prospects does one run find?",
        a: (
          <>
            <p>Typically <b>3–15 real sends per run</b> at dailyCap=10.</p>
            <p className="mt-2">Funnel:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              <li>Google Places: up to <b>20</b> businesses per search</li>
              <li>contactsPerCompany (default 3) × 20 = max 60 candidates</li>
              <li>Hunter/Snov finds an email: <b>30–50%</b> of small local businesses</li>
              <li>Verification passes (score ≥ 70): <b>60–70%</b></li>
              <li>AI fit score ≥ 60: <b>40–60%</b></li>
              <li>Capped by dailyCap</li>
            </ul>
          </>
        ),
      },
      {
        q: "Why did a run produce zero prospects?",
        a: (
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>Is the campaign <code>active</code>? <code>draft</code> campaigns are skipped</li>
            <li>Is the ICP (city / vertical) too niche? Try a broader city</li>
            <li>Check <code>events</code> rows with kind <code>company.skipped</code> for reason</li>
            <li>Are Hunter / Snov quotas exhausted? See dashboard quota cards</li>
          </ol>
        ),
      },
      {
        q: "Will the same company be contacted repeatedly?",
        a: "No. Dedup is by email. Same-domain enrichment is cached per run. Previously-contacted prospects get skipped with events kind=already_in_list.",
      },
    ],
  },
  {
    title: "Recommended workflow",
    items: [
      {
        q: "How should I use this the first time?",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Create a campaign</b> — one vertical, tight ICP, dailyCap start at <b>5</b></li>
            <li><b>Preview 10</b> — review drafts, check fit scores + tone</li>
            <li><b>Tune prompts / ICP</b> if needed</li>
            <li><b>Preview 5 more</b> to confirm fixes</li>
            <li><b>Manually send 3</b> — click Send Now on each, watch for deliverability</li>
            <li><b>Activate</b> the campaign for cron-driven runs</li>
            <li><b>Scale</b> dailyCap +5 every 3 days (warmup)</li>
          </ol>
        ),
      },
      {
        q: "What's the maintenance cadence?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Daily</b>: dashboard glance (sent / replies / quotas / cron)</li>
            <li><b>Every 2–3 days</b>: replies inbox, classify intent</li>
            <li><b>Weekly</b>: review skipped-prospect reasons, adjust ICP</li>
            <li><b>Monthly</b>: audit prompt templates, refresh signature</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: "Sending & deliverability",
    items: [
      {
        q: "Why did a run complete but send zero emails?",
        a: "Most common reasons: campaign is draft; Brevo DNS not verified; dailyCap already hit; mode is preview; all prospects filtered by score / suppression / dedup.",
      },
      {
        q: "Why does dailyCap exist?",
        a: "Sender reputation. Cold senders ramping too fast get spam-filtered. Warmup from 5 → 100/day over 2-3 weeks is the safe pattern.",
      },
      {
        q: "My email got flagged as spam. What do I do?",
        a: "Check DMARC rua reports, pause the campaign, rewrite prompts to sound less promotional, manually send a few to friendly inboxes, consider moving to an outreach subdomain.",
      },
    ],
  },
  {
    title: "Cost & quotas",
    items: [
      {
        q: "How much does 100 sends cost?",
        a: "Approximately $0.20–0.35 total. AI tokens (~$0.20) + Google Places ($0.15, but covered by $200/mo free credit). Hunter/Snov/Brevo all within free tiers.",
      },
      {
        q: "What happens when a quota runs out?",
        a: "Brevo daily cap hit → stops sending until midnight reset. Hunter/Snov monthly cap → enrichment returns empty, prospects skipped gracefully. Google Places → starts charging past free tier. System fails gracefully.",
      },
    ],
  },
];

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");

  const sections = locale === "zh" ? faqZh : faqEn;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-sm text-neutral-500 mb-8">{t("subtitle")}</p>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <details
                  key={i}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 group"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 list-none flex items-center justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="text-neutral-400 group-open:rotate-90 transition-transform shrink-0">
                      ›
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
