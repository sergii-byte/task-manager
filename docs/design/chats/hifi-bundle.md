# Resume Design

_Started 2026-04-30 14:15 UTC_

---

## User



## Assistant

I'll help you with your Ordify project. Let me first explore the design brief to understand what you're working with.

_[tool: read_file]_

Let me explore the existing design assets to understand the locked visual system.

_[tool: read_file]_

_[tool: read_file]_

I have a strong sense of the locked design system now. Let me confirm direction and priorities before building.

_[tool: read_file]_

_[tool: snip]_

Now I have a strong sense of the locked Ordify visual system. Let me set up the project, copy the shared assets, and build the priority screens. Per the brief's priority order, I'll deliver the most distinctive screens first: Time tracker, Invoice document, Matter-subscription, Calendar, then the rest.

_[tool: set_project_title]_

_[tool: copy_files]_

_[tool: update_todos]_

I'll start building the screens. Let me begin with the most distinctive one — the Time tracker (hifi-08) — and skip the shared partial idea since each file is meant to be standalone per the brief.

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Now Invoice document — the editorial pinnacle with plum AMOUNT block.

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Now matter-subscription with the scope gauge — a daily-use detail screen.

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Now Calendar — different paradigm with month grid.

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Let me check what tokens & styles are available so I match patterns.

_[tool: read_file]_

Now invoices list — straightforward.

_[tool: write_file]_

_[tool: update_todos]_

Now matter-fixed (milestones checklist + countdown).

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Now matter-hourly.

_[tool: write_file]_

## User

Прочитай BRIEF.md внимательно. Это полное ТЗ.
Изучи hifi-04-tasks-table.html и hifi-06-integrated.html
как референс визуального стиля.
Начни с hifi-08-time.html (самый feature-rich, lime tracker).

## Assistant

## User

resume

## Assistant

_[tool: snip]_

_[tool: update_todos]_

_[tool: list_files]_

Now Client detail screen — pulls a client's matters, invoicing, contacts together.

_[tool: write_file]_

_[tool: update_todos]_

_[tool: snip]_

Now Settings — final detail screen, then index.

_[tool: write_file]_

_[tool: update_todos]_

_[tool: snip]_

Слышу. То что я делал — это Bento-grids и таблицы, как у всех. Давай по-настоящему. Что я сейчас сделаю — **один экран который заменяет 10**. Не дашборд, не вьюшка задач. Живая лента дня где AI работает рядом с тобой как стажёр-параюрист.

Идея: **сегодняшний день как горизонтальная timeline-ленточка** где время течёт слева направо. AI-стажёр пишет тебе в боковом канале короткие сообщения (как Linear-чат), предлагает действия одной кнопкой. Все объекты — таски, таймер, инвойсы, звонки, дедлайны — живут на одной timeline. Drag по timeline = планирование. Speak в любой момент = capture. **Одна страница, один контекст, ноль навигации.**

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

Открыл. Это **FLOW** — один экран вместо десяти.

Ключевая идея: **горизонтальная лента дня**. Время течёт слева направо, *всё* живёт на одной полосе — таски, митинги, дедлайны, инвойсы, email-захваты, живой таймер. Прошлое заштриховано, NOW — плам-линия, будущее открыто. Слева красный флаг overdue (−20h OFAC) тебе физически невозможно не заметить.

Справа — **AI-ассошиэйт в чате**. Не "ассистент", а живой коллега который:
- утром даёт бриф ("одно главное на сегодня — Acme 14:00")
- видит что ты пишешь консент 47 минут и сам говорит "ты в 78% ретейнера, ещё 2.6h до овераджа"
- сам собирает инвойс из 23 таймлогов, объясняет **почему сгруппировал именно так** (reasoning-чип фиолетовым)
- запоминает правила ("NDA = €120/h, спрошу при новом матере")
- голос держится на пробеле, ⌘K везде

Что здесь по-настоящему другое:
1. **AI-ghost-карточки** (пунктир, плам) — AI кладёт предложенные блоки прямо на твой день. Один тап — принял.
2. **Reasoning-чипы** — AI всегда показывает *почему* он так сделал, кратко. Не чёрный ящик.
3. **Drag по timeline = расписание.** Двойной тап на пустое = блок.
4. **Овердью не в списке, а как физический красный обрыв слева от NOW** — невозможно проигнорировать.
5. **Один контекст.** Никаких "перейти в Invoices, потом в Time, потом в Matters". Всё происходит здесь.

Если эта концепция цепляет — следующее что надо решить:
- хочешь видеть **неделю** в этом же формате (7 рядов параллельно)?
- или **таск в фокусе** — один объект раскрывается на всю ширину со всем контекстом?
- или **ночной режим / морнинг-бриф** — отдельный вид как ты входишь в день?

Скажи что зашло, что нет — переделаю прицельно.

## User

покажи на большом єкране

## Assistant

Понял — оптимизирую под большой экран. Сейчас лента имеет фиксированную ширину 1540px, на 27"+ остаётся пустое место справа, и колонки не используют всю высоту. Переделаю под full-width.

_[tool: read_file]_

Вместо точечных правок — сразу делаю v2 под большой экран (1920+). Главные изменения: лента растягивается на всю ширину (часовая ширина считается из viewport), AI rail шире (440px), карточки крупнее, увеличу типографику, добавлю вертикальные swimlanes так чтобы они занимали всю высоту.

_[tool: copy_files]_

Теперь полностью перепишу v2 под большой экран:

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Открыл v2. Лента теперь fluid — растягивается на всю ширину экрана. Хедер с 88px заголовком, AI rail расширил до 460px, swimlane-метки слева (FOCUS / MEETINGS / DELIVERIES), карточки крупнее с иконками-маркерами (✓ done, ● REC live, ⚠ deadline, € invoice).

Что важно проверить на твоём экране:
- Карточки не перекрываются и читаются на 1920+
- Vermillion-блок overdue достаточно громкий
- Plum AI-ghost-карточки справа от NOW зовут к действию

Скажи что в v2 работает, что нет — и куда копать дальше: **неделя в этом формате**, **focus-режим одного матера**, или другой ракурс.

## User

нет, еще варианты - сделай минималистично

## Assistant

_[tool: snip]_

Делаю минималистичную версию. Уберу всё лишнее: никаких хедеров, цветных блоков, иконок, KPI. Только то что критически нужно — текст, время, и одна линия NOW. Чёрное на белом, моно-шрифт, всё дышит.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

Открыл **flow / minimal** — без хедеров, без цветных блоков, без иконок. Только:

- **День как простой список строк** — время · действие · клиент. Ничего больше.
- **Прошлое — приглушено**, перечёркнуто если done
- **NOW — одна горизонтальная плам-линия** между прошлым и будущим
- **Overdue — единственное цветовое исключение** (vermillion `−20h`), потому что это реально требует внимания
- **Suggested — внизу полупрозрачно**, проявляются на ховер
- **AI rail — текст, никаких карточек**. Сообщения как заметки. Действия — текстовые ссылки с подчёркиванием, не кнопки.

Бренд `ordify·` мелким шрифтом в углу, навигация — 4 слова сверху. Никаких сайдбаров, KPI, бейджей. Пустоты много специально.

Скажи — это направление? Или ещё минималистичнее (например, только день, без AI rail вообще; или AI говорит только когда его спросят).

## User

это направление

## Assistant

Отлично. Закреплю направление и начну собирать остальные экраны Ordify в этой минималистичной эстетике. Что дальше — расскажи приоритет:

1. **Matter detail** в minimal-стиле (тот же принцип: один список, прошлое-сейчас-будущее, ambient AI)
2. **Week view** — 7 дней такими же строками
3. **Invoice document** в minimal — только текст, никаких блоков
4. **Capture / quick add** — что происходит когда нажимаешь ⌘K
5. **Index** всех экранов

Скажи с чего продолжать — и продолжу прицельно в этом языке.

## User

делай степ бай степ

## Assistant

Начну step by step. Шаг 1 — **Matter detail** в minimal-эстетике (берём Acme / shareholder consent — тот матер с которым работали в FLOW).

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

**Шаг 1 готов: Matter detail / minimal**.

Тот же визуальный язык что и FLOW:
- Единый принцип "когда · что · статус"
- Активность матера как одна лента: live timer (плам полоса слева) → done items (приглушены)
- Scope как тонкая линия с пунктирной проекцией overage — без блоков и pie-чартов
- Upcoming и notes теми же строками
- AI rail контекстный к матеру: видит твою историю заметок, паттерн 6 циклов, предлагает действие из январской записи

Скажи **next step** — какой экран собирать дальше:

- **Invoice document** (минимально, как макет письма)
- **Week view** (7 дней этими же строками)
- **Capture / ⌘K** (что происходит когда пишешь команду)
- **Index** всех экранов

## User

дальше

## Assistant

Шаг 2 — **Invoice document / minimal**. Самое подходящее место для типографики: счёт это по сути письмо.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

**min-invoice.html** — счёт как **письмо**, не как форма.

Что сделал по-другому:
- **Фирменный inv·042 на 88px** в плам — это название документа, не «invoice number: 042» в углу
- **Lines без зебры, без боксов** — типографическая таблица. 16px description + 11px mono context-meta под ней (matter id · type · grouping rule)
- **Note слева от тоталов** объясняет почему так сгруппировано и почему VAT = €0 (reverse-charge, ст. 196 Directive 2006/112) — это юристам важно
- **Total due €5,355 в плам, 40px** — единственный по-настоящему громкий элемент в документе
- **AI-rail справа = соавтор**, а не «ассистент». Три turn'а: «как сгруппировал», «что подтвердить» (3 точных вопроса), «история с клиентом» (acme платит за 9 дней, был typo в IBAN — здесь проверил)
- **Status-bar над документом** — `draft · ready to send` пульсирует плам, справа inline-actions без кнопок: `preview · edit lines · download pdf · send to acme →`

Логика: документ — это финал. AI-rail — это диалог о финале. Никаких полей формы, никаких dropdown'ов на самом инвойсе.

Куда дальше? Остался **index.html со всеми экранами** (старый+новый стек), или сразу следующий screen в minimal — **calendar / week**, **matter detail** или **today**?

## User

дальше

## Assistant

_[tool: snip]_

Дальше — **matter detail / minimal**. Самый частый экран в работе юриста; здесь должна жить вся история одного дела.

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**min-matter.html** — досье одного дела как длинное эссе.

Что нового по сравнению с invoice:
- **Hero — заголовок-предложение** "ongoing retainer, general counsel" с серьезной запятой и плам-точкой. Lede объясняет матер двумя предложениями
- **SCOPE-блок без графика** — соотношение 9.4/12h на 96px как главная цифра, 12-сегментный bar, 6 фактов справа (cycle / last invoiced / overage forecast / avg / jurisdictions / opened)
- **Pull-quote с AI-инсайтом прямо в странице** — плам left-rule, 22px sans, как цитата в журнале
- **5 разделов прокручиваемой ленты**: open work · activity · time · documents · people. Все одной типографикой, только границы — никаких карточек, никаких боксов
- **Activity = narrative**: каждое событие читается как фраза, не как лог. Ссылки подчеркнуты hairline. AI-события отмечены плам кружком
- **Time-блок** с включёнными часами (€0 because scope-included) и ★ ai-меткой откуда entry пришёл
- **AI rail на правах второго пилота**: scope-prediction → 2 nudges → retainer health. Не "помощник" — co-pilot.

## User

дальше

## Assistant

Дальше — **today / minimal**, главный экран открытия дня.

_[tool: snip]_

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

**min-today.html** — открытие дня как утреннее эссе.

Главное:
- **Заголовок-фраза** "three things matter today." — не "Tuesday Dashboard"
- **Pull-quote под hero** в плам — AI озвучивает что важно прямо сейчас, одним предложением
- **Schedule — это вертикаль времени**, не календарь. Каждый слот: время · marker · label/title/context. Done — серый strike, current — пульсирующий плам ring со встроенным AI-nudge'ом, deep/meet — разные цвета marker'а
- **NOW-line** — буквальная плам-черта поперёк schedule с фразой "2h 18m of focused work left until your next call". Это не виджет, это позиция в текущем дне
- **Inbox triaged** — уже не «3 unread», а 3 уже-прочтённых письма с **summary от AI** ("she wants you to weigh in on §6.4 and §11 before the call"), **action needed | no action needed | cold** в первой строке summary, и inline-actions
- **AI rail = 3 фрейма**: status (where you are) · decisions (3 numbered things waiting) · later (non-urgent, surface again monday)

Hero stats — `3/8 done` · `timer 2:14` · `14.3h week` · `closest deadline 2d term sheet · warn`.

Дальше: **week / minimal** (как сетка дней), или сразу **billing list** / **calendar** / **client detail**?

## User

week / minimal

## Assistant

_[tool: snip]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

**min-week.html** готов — 7-колоночный недельный grid с now-line, hour-bands, AI-контингенси (held flex на пятницу из-за паттерна последних 4 пятниц), и 3-колоночный digest снизу. Ритм: hero → grid → pull-quote → by-client / forecast / read-of-the-week.

## User

дальше

## Assistant

_[tool: snip]_

_[tool: list_files]_

Дальше у нас в minimal-серии не хватает **min-billing** — место, где видно весь финансовый поток (invoices + outstanding + DSO + cash forecast) в той же editorial-ритмике что и week / invoice / today / matter.

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**min-billing.html** готов — 12-week cashflow stack (8 past + 4 dashed forecast), 4 outstanding invoices с urgency-сорт, DSO histogram по клиентам (maersk 21d — единственный outlier), 30-day cash forecast и read-of-the-cycle про concentration risk на acme (51% портфеля).

## User

дальше

## Assistant

Time to build the index. Let me create a clean entry point linking all 22 screens.

_[tool: write_file]_

_[tool: update_todos]_

_[tool: done]_

Let me check that the flow-study links actually exist before declaring done.

_[tool: list_files]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**index.html готов** — стартовая точка с тремя секциями:

- **★ Minimal · v2** (primary) — 5 готовых экранов: today, week, matter, invoice, billing + 1 placeholder
- **Hi-fi · v1** — 14 hi-fi экранов с reference-меткой на integrated
- **Flow studies** — 3 flow-прототипа

Pull-quote по центру: «the rail is not a panel. it's the second voice in a working conversation. everything else is paper.»

Открыто в превью. Если хочешь — следующим шагом портирую оставшиеся surfaces (capture · client · settings) в minimal-направление, либо доработаем что-то конкретное.

## User

дальше

## Assistant

Port the remaining surfaces (capture · client · settings) into the minimal direction. Start with capture — the daily entry point.

_[tool: read_file]_

_[tool: snip]_

_[tool: read_file]_

_[tool: snip]_

_[tool: read_file]_

_[tool: snip]_

Now I have the minimal vocabulary down. Building **min-capture.html** — the daily entry point. Capture is special: it's the moment of intake, voice-first, the AI does the parsing in real-time. The minimal version makes this a conversational interview, not a form.

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**min-capture.html готов** — voice-first intake в minimal-направлении.

Ключевые ходы:
- **Live transcript** в serif-блоке с plum quote-mark, dashed-underline для uncertain слов («morris nicholas» → unsure)
- **4 extracted things** с confidence-метками (98% · 94% · 62% · 91%) — rail показывает что AI делает прямо сейчас
- **Single question** в dashed-plum рамке: только одна вещь требует проверки (morris nichols disambiguation), остальное сохраняется автоматически
- **Earlier today** — 5 предыдущих captures с output-метками («3 timelogs · 2 tasks · saved», «inv·042 draft bundled»)
- **Live waveform** в rail с реальной анимацией баров

Принцип: «i'd rather ask once than guess wrong twice». Дальше — client и settings в minimal.

## User

дальше

## Assistant

Building **min-client.html** — client detail in minimal direction. Plum hero, editorial matters list, conversational AI rail.

_[tool: snip]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

**min-client.html готов** — клиентская карточка в minimal-направлении.

Композиция:
- **Hero** — крупный «acme tech.» с lede о 28 месяцах и series b, плюс 5-stat ряд (lifetime €42.3k · 2/4 matters · €4,719 outstanding · 9d to pay · last seen 3d)
- **Pull-quote** — concentration risk наблюдение от ordify (51% revenue в одном клиенте)
- **Matters** — 4 строки с inline scope-gauges, цветные tag-метки (SUB/HR/FIX/CLOSED), retainer на 78% scope подсвечен warn
- **Invoicing** — компактный ledger 6 последних счетов, draft / paid статусы цветом
- **Recent activity** — timeline с цветными точками (meet/bill/doc) для последнего месяца
- **People & book** — слева 3 контакта с primary-карточкой (marta), справа справочник реквизитов

AI rail conversational: что важно знать → что в очереди на твоё ревью → исторический паттерн (scope creep на ~€3k за 28 месяцев). 

Дальше — settings в minimal, и потом index чтобы связать всё.

## User

дальше

## Assistant

Building **min-settings.html** — settings in minimal direction.

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**min-settings.html готов** — settings в minimal-направлении.

Ключевые ходы:
- **Sticky TOC** слева (240px) с 7 секциями, активная подсвечена plum-бордером
- **Hero** «settings.» с lede про принцип «ordify shows what shifts before you save»
- **7 пронумерованных секций** (01 identity → 07 data & danger), у каждой meta-метка справа («✓ saved 2 min ago» / «4 of 5 connected» / «irreversible after confirm»)
- **Поля как inline тексты** с underline-style — никаких box-инпутов; descriptive `↳ field-meta` под каждым полем показывает что меняется
- **Slider-rows** для rate (€80—€280, текущее €150) и scope-warning threshold (85%)
- **Connections list** с цветными glyph-плитками: gmail (ink) / cal (plum) / zoom (cobalt) / drive (saffron) / bank (dashed, not connected)
- **Autonomy radio** — 3 уровня (cautious / balanced / forward), текущий «balanced» подсвечен
- **Always-ask toggles** — outline-style тогглы для критичных действий (send invoice / change scope / draft legal advice)
- **Sticky save-bar** внизу с «2 unsaved changes» и «save & preview impact →»
- **AI rail = impact preview** — conversational объяснение того, что *change* что-либо в settings *означает на практике* (rate bump → existing matters keep old, new ones get new; scope warning 90→85 → acme retainer becomes ‘warning’ во вторник)

Все 6 minimal-экранов готовы: today · week · capture · client · settings + tasks (если был). Дальше — `index.html` чтобы связать оба направления (editorial + minimal) в одну точку входа.

## User

дальше

## Assistant

Building **index.html** — single entry point that links both directions (editorial + minimal) and all screens.

_[tool: snip]_

_[tool: list_files]_

_[tool: read_file]_

index.html уже существует — давайте посмотрим целиком и обновим его.

_[tool: read_file]_

The index.html already exists and references all screens (5 minimal + 13 hi-fi + 3 flow studies). It needs an update to reflect the additional minimal screens completed (capture, client, settings) and remove the "planned" placeholder.

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: done]_

**index.html обновлён** — теперь 8 minimal экранов (today · week · matter · invoice · billing · capture · client · settings) + 13 hi-fi + 3 flow studies.

## User

что еще?

## Assistant

Дизайн-пакет в текущем виде закрывает весь брифинг:

**8 minimal экранов** (рекомендованное направление) — today, week, matter, invoice, billing, capture, client, settings  
**13 hi-fi экранов** (v1, для референса) — capture → settings  
**3 flow studies**  
**index.html** — единая точка входа

Возможные следующие шаги, если интересно:

1. **Mobile/responsive проход** для minimal — сейчас они оптимизированы под desktop (≥1100px). Можно добавить mobile-варианты для today / capture / matter (часто проверяют со смартфона).
2. **Empty / first-run states** — как minimal-today выглядит у нового пользователя без матерей и инвойсов; onboarding в духе «week 1 ordify learns your tone».
3. **Edge cases** — overdue invoice, scope spillover (sub-matter > 100%), bank-reconciliation conflict, contested timelog.
4. **Dark mode** — minimal-направление просится в тёплый тёмный (paper → ink, plum остаётся).
5. **Один интерактивный prototype** — например, capture → matter creation → invoice draft, со связанным state.
6. **Brand sketch** — wordmark / logo lockup в духе minimal (lowercase + plum dot).
7. **Component sheet** — собрать atomic-элементы (toggles, sliders, gauges, cards) в один doc для разработчиков.

Скажи, что из этого ценно — или есть своё направление.

## User

давай все

## Assistant

_[tool: snip]_

_[tool: update_todos]_

Starting with **brand sketch** (smallest, sets visual vocabulary for the rest), then component sheet, then dark mode + edge cases + empty state in sequence.

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Building **min-empty.html** (first-run state) next, then dark mode + edge cases + mobile + prototype + index update.

_[tool: write_file]_

Now **min-edge.html** — overdue/spillover/conflicts edge cases on a single editorial sheet.

_[tool: update_todos]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: snip]_

Now **min-mobile.html** — three mobile variants (today, capture, matter) on one canvas.

_[tool: write_file]_

_[tool: update_todos]_

