// site-content-seed.js — default values for the editable homepage content
// (super-admin "Website content" dashboard). These are only ever INSERTed
// with ON CONFLICT (key) DO NOTHING at startup, so they seed the table once
// and never overwrite a real edit made later from the dashboard — this file
// is just where the ORIGINAL wording/images live, matching what was
// hardcoded in home.html before the dashboard existed.
//
// Three kinds of rows:
//   'text'  — mn/en/jp strings, one per data-i18n key on home.html
//   'image' — one per scroll-story scene photo (9 total, stage 0-8)
//   'block' — a whole section or repeatable card/item that can be hidden
//             from the live site without editing any code

const TEXT_SEED = {
  nav_gps: { en: "Real-time GPS", mn: "Бодит цагийн байршил", jp: "リアルタイムGPS" },
  nav_how: { en: "How it works", mn: "Хэрхэн ажилладаг", jp: "使い方" },
  nav_benefits: { en: "Benefits", mn: "Давуу тал", jp: "メリット" },
  nav_faq: { en: "FAQ", mn: "Асуулт хариулт", jp: "よくある質問" },
  nav_contact: { en: "Contact", mn: "Холбоо барих", jp: "お問い合わせ" },
  intro_eyebrow: { en: "Meet OneTag", mn: "OneTag-тай танилцах", jp: "OneTagのご紹介" },
  scroll_hint: { en: "Scroll to see how it works ↓", mn: "Хэрхэн ажилладгийг үзэхийн тулд гүйлгэнэ үү ↓", jp: "スクロールして仕組みを見る ↓" },
  story_2: { en: "Everything that matters, saved in seconds.", mn: "Хэрэгтэй бүх мэдээлэл секундын дотор хадгалагдана.", jp: "大切な情報を、数秒で記録。" },
  story_3: { en: "Every morning starts the same way.", mn: "Өглөө бүр ижил байдлаар эхэлдэг.", jp: "毎朝、同じように一日が始まります。" },
  story_4: { en: "Every child, accounted for the moment they arrive.", mn: "Хүүхэд бүр ирсэн даруйдаа бүртгэгдэнэ.", jp: "登校した瞬間に、すべての子どもの出席が確認されます。" },
  story_5: { en: "One tap at the gate is all it takes.", mn: "Хаалганд нэг товшилт л хэрэгтэй.", jp: "校門でタップするだけ。" },
  story_8: { en: "The school knows the instant they're in.", mn: "Сургууль тэднийг ирсэн даруйд нь мэднэ.", jp: "登校した瞬間、学校はすぐに把握します。" },
  story_10: { en: "Left safely. Parents know instantly.", mn: "Аюулгүй явлаа. Эцэг эх шууд мэднэ.", jp: "無事に下校。保護者はすぐに知ることができます。" },
  story_11: { en: "See exactly where — down to the meter.", mn: "Хаана байгааг нь метрийн нарийвчлалтай харна.", jp: "メートル単位で、正確な位置がわかります。" },
  label_name: { en: "Name", mn: "Нэр", jp: "名前" },
  label_allergies: { en: "Allergies", mn: "Харшил", jp: "アレルギー" },
  label_blood: { en: "Blood Type", mn: "Цусны бүлэг", jp: "血液型" },
  label_contact: { en: "Emergency Contact", mn: "Яаралтай холбоо", jp: "緊急連絡先" },
  label_school: { en: "School", mn: "Сургууль", jp: "学校" },
  label_class: { en: "Grade", mn: "Анги", jp: "学年" },
  story_crane: { en: "Another school morning begins.", mn: "Сургуулийн өглөө дахин эхэлж байна.", jp: "また学校の朝が始まります。" },
  intro_1: { en: "Meet OneTag — a silicone NFC wristband for children.", mn: "OneTag — хүүхдэд зориулсан силикон NFC бугуйвч.", jp: "OneTagのご紹介 — 子ども向けシリコン製NFCリストバンドです。" },
  intro_2: { en: "Tap at the school gate every morning...", mn: "Өглөө бүр сургуулийн хаалганд товшино...", jp: "毎朝、校門でタップ…" },
  intro_3: { en: "...and every afternoon.", mn: "...орой бүр мөн адил.", jp: "…そして毎日下校時にも。" },
  intro_4: { en: "If they're ever lost, anyone can tap and call you — instantly.", mn: "Хэрэв тэднийг олдохгүй бол хэн ч товшоод танд шууд залгаж болно.", jp: "万が一迷子になっても、誰でもタップしてすぐに保護者へ連絡できます。" },
  intro_5: { en: "In an emergency, one tap finds them in seconds — real-time GPS.", mn: "Онц үед нэг товшилтоор секундын дотор олно — бодит цагийн GPS.", jp: "緊急時も、ワンタップで数秒以内に位置を特定 — リアルタイムGPS。" },
  nav_parents: { en: "For Parents", mn: "Эцэг эх", jp: "保護者の方へ" },
  nav_staff: { en: "School Login", mn: "Сургуулийн нэвтрэх", jp: "学校スタッフログイン" },
  eyebrow: { en: "NFC Safety Wristband", mn: "NFC аюулгүй байдлын бугуйвч", jp: "NFC安全リストバンド" },
  hero_h1: { en: "Safe every school day. Peace of mind for parents. Found in seconds.", mn: "Сургуулийн өдөр бүр аюулгүй. Эцэг эхэд санаа зовохгүй байдал. Секундын дотор олдоно.", jp: "毎日安心して登校。保護者にも安心を。数秒で居場所がわかります。" },
  hero_sub: { en: "OneTag is a wristband that logs safe arrival and departure at school automatically — and instantly shows real-time location and emergency details to anyone who finds your child, anywhere else.", mn: "OneTag бол сургуульд ирсэн, явсныг автоматаар бүртгэдэг бугуйвч — мөн хаана ч олдсон хүүхдийг олсон хэн бүхэнд бодит цагийн байршил, яаралтай тусламжийн мэдээллийг шууд харуулдаг.", jp: "OneTagは登校・下校を自動で記録するリストバンドです。万が一お子さまが離れた場所で見つかった場合も、発見した方にリアルタイムの位置情報と緊急時の情報を即座に表示します。" },
  hero_cta_primary: { en: "Get OneTag for your school", mn: "Сургуульдаа OneTag авах", jp: "学校にOneTagを導入する" },
  hero_cta_secondary: { en: "See how fast it works", mn: "Хэр хурдан ажилладгийг үзэх", jp: "その速さを見てみる" },
  story_close_product: { en: "One wristband. Every school day.", mn: "Нэг бугуйвч. Сургуулийн өдөр бүр.", jp: "一つのリストバンドで、毎日の学校生活を。" },
  panel_lost_title: { en: "If they're ever lost", mn: "Хэрэв тэднийг олдохгүй бол", jp: "もし迷子になったら" },
  panel_lost_p: { en: "Anyone who finds them taps the wristband and instantly sees a name, photo, blood type, allergies, and medical notes — plus one button to call you. Your number stays private, always.", mn: "Тэднийг олсон хэн ч бугуйвчийг товшиход нэр, зураг, цусны бүлэг, харшил, эрүүл мэндийн тэмдэглэл, мөн танд залгах нэг товчлуур шууд харагдана. Таны дугаар үргэлж нууц хэвээр байна.", jp: "発見した方がリストバンドをタップすると、名前・写真・血液型・アレルギー・医療メモがすぐに表示され、保護者への通話ボタンも利用できます。電話番号は常に非公開です。" },
  panel_daily_title: { en: "Every single school day", mn: "Сургуулийн өдөр бүр", jp: "毎日の学校生活で" },
  panel_daily_p: { en: "A tap at the gate each morning and afternoon sends an instant notice: arrived safely, left safely. No sign-in sheets, no wondering.", mn: "Өглөө, оройн хаалганы товшилт бүр танд шууд мэдэгдэл илгээнэ: аюулгүй ирлээ, аюулгүй явлаа. Бүртгэлийн хуудас, эргэлзээ хэрэггүй.", jp: "毎朝・毎夕の校門タップで、登校・下校の通知が即座に届きます。出席簿も、心配する必要もありません。" },
  photo_caption: { en: "Tap here", mn: "Энд товшино уу", jp: "ここをタップ" },
  reveal_badge: { en: "Found — tap to help", mn: "Олдлоо — тусламж үзүүлэхийн тулд товшино уу", jp: "発見しました — タップして助ける" },
  reveal_sub: { en: "Age 7 · Special Needs School", mn: "7 настай · Тусгай хэрэгцээт сургууль", jp: "7歳・特別支援学校" },
  reveal_allergy_label: { en: "Allergies", mn: "Харшил", jp: "アレルギー" },
  reveal_allergy_val: { en: "Peanuts", mn: "Газрын самар", jp: "ピーナッツ" },
  reveal_condition_label: { en: "Condition", mn: "Онцлог", jp: "特性" },
  reveal_condition_val: { en: "Non-verbal, ASD", mn: "Хэлгүй, аутизм", jp: "非言語・自閉スペクトラム症" },
  reveal_blood_label: { en: "Blood type", mn: "Цусны бүлэг", jp: "血液型" },
  reveal_call: { en: "Call guardian now", mn: "Асран хамгаалагчид одоо залгах", jp: "今すぐ保護者に電話" },
  reveal_close: { en: "Close", mn: "Хаах", jp: "閉じる" },
  gps_eyebrow: { en: "Real-time location", mn: "Бодит цагийн байршил", jp: "リアルタイム位置情報" },
  gps_title: { en: "See how fast we find them", mn: "Бид хэр хурдан олдгийг үзээрэй", jp: "発見までの速さを体験" },
  gps_sub: { en: "Real GPS, not a guess. Tap below to see it work.", mn: "Таамаглал биш, бодит GPS. Доорх товчийг дарж үзээрэй.", jp: "推測ではなく、本物のGPS。下のボタンを押して体験してください。" },
  gps_btn: { en: "Locate now", mn: "Одоо байрлуулах", jp: "今すぐ位置を特定" },
  gps_btn_again: { en: "Locate again", mn: "Дахин байрлуулах", jp: "もう一度位置を特定" },
  gps_result_prefix: { en: "Found in", mn: "Олдсон хугацаа:", jp: "所要時間" },
  gps_result_suffix: { en: "accurate to about 20 meters", mn: "~20 метрийн нарийвчлалтай", jp: "誤差約20メートル" },
  gps_result_accuracy_prefix: { en: "accurate to", mn: "нарийвчлал:", jp: "精度" },
  gps_denied_note: { en: "Location access was declined — try again and allow location in your browser to see your real position.", mn: "Байршлын зөвшөөрөл өгөгдөөгүй — дахин товшоод хөтчөөс байршилд зөвшөөрөл өгвөл бодит байршлаа харах боломжтой.", jp: "位置情報へのアクセスが拒否されました — もう一度お試しいただき、ブラウザで位置情報を許可すると実際の位置が表示されます。" },
  gps_footer_note: { en: "The same real-time GPS runs every time the wristband is tapped — at the school gate, or anywhere else.", mn: "Бугуйвчийг товшох бүрд яг ижил бодит цагийн GPS ажилладаг — сургуулийн хаалганд ч, хаана ч байсан.", jp: "リストバンドをタップするたびに、同じリアルタイムGPSが作動します — 校門でも、どこにいても。" },
  gps_privacy_note: { en: "This demo uses your real location to show how it works — it's never stored or sent anywhere.", mn: "Энэ демо нь хэрхэн ажилладгийг үзүүлэхийн тулд таны бодит байршлыг ашиглана — хаана ч хадгалагдахгүй, илгээгдэхгүй.", jp: "このデモではお客様の実際の位置情報を使用して仕組みをご紹介しています — 保存や送信は一切行われません。" },
  gps_real_caption: { en: "A real screen from the OneTag app", mn: "OneTag аппын бодит дэлгэц", jp: "OneTagアプリの実際の画面" },
  stats_eyebrow: { en: "Why this matters", mn: "Яагаад чухал вэ", jp: "なぜ重要なのか" },
  stats_title: { en: "Every day, thousands of children face risks they can't explain", mn: "Өдөр бүр мянга мянган хүүхэд тайлбарлаж чадахгүй эрсдэлтэй тулгардаг", jp: "毎日、何千人もの子どもたちが、自分では説明できない危険にさらされています" },
  stat_a_label: { en: "people living with disabilities in Mongolia today", mn: "Монголд өнөөдөр хөгжлийн бэрхшээлтэй амьдарч буй хүн", jp: "現在モンゴルで暮らす障がいのある人々" },
  stat_b_label: { en: "children with disabilities nationwide", mn: "хөгжлийн бэрхшээлтэй хүүхэд улс даяар", jp: "全国の障がいのある子どもたち" },
  stat_c_label: { en: "road injuries involving children in a single year", mn: "нэг жилд хүүхэдтэй холбоотой замын хөдөлгөөний осол гэмтэл", jp: "年間の子どもが関わる交通事故によるけが" },
  stats_footer: { en: "A child who can't speak can't be found by name. OneTag gives them a voice when it matters most.", mn: "Ярьж чадахгүй хүүхдийг нэрээр нь олох боломжгүй. OneTag хамгийн хэрэгтэй мөчид тэдэнд дуу хоолой болдог.", jp: "言葉を話せない子どもは、名前で見つけてもらうことができません。OneTagは、最も必要な瞬間に子どもたちに声を与えます。" },
  features_eyebrow: { en: "Features", mn: "Онцлогууд", jp: "機能" },
  features_title: { en: "Everything built in, ready on day one", mn: "Бүх зүйл нэг дор, эхний өдрөөс бэлэн", jp: "すべての機能を標準搭載、導入初日から利用可能" },
  features_sub: { en: "One wristband, one dashboard, no extra hardware to manage.", mn: "Нэг бугуйвч, нэг удирдлагын самбар, нэмэлт төхөөрөмж хэрэггүй.", jp: "一つのリストバンド、一つのダッシュボードで、追加のハードウェア管理は不要です。" },
  feat_1_title: { en: "Real-time GPS", mn: "Бодит цагийн GPS", jp: "リアルタイムGPS" },
  feat_1_p: { en: "Every tap shows a location within seconds — a real measurement, not a guess.", mn: "Товшсон бүрт хүүхдийн байршлыг секундын дотор харуулна — таамаглал биш, бодит хэмжилт.", jp: "タップするたびに数秒で位置情報を表示 — 推測ではなく、実際の測定値です。" },
  feat_2_title: { en: "NFC technology", mn: "NFC технологи", jp: "NFC技術" },
  feat_2_p: { en: "Works with any NFC-capable phone — no special reader needed for a finder to help.", mn: "NFC дэмждэг ямар ч утсаар ажиллана — тусламж үзүүлэхэд тусгай уншигч хэрэггүй.", jp: "NFC対応のスマートフォンであればどれでも利用可能 — 発見者が特別な読み取り機を用意する必要はありません。" },
  feat_3_title: { en: "Attendance tracking", mn: "Ирцийн бүртгэл", jp: "出席管理" },
  feat_3_p: { en: "Gate taps log arrival and departure automatically, with time and location.", mn: "Хаалганы товшилт ирц, явцыг цаг хугацаа, байршилтай нь автоматаар бүртгэнэ.", jp: "校門でのタップにより、登校・下校の時刻と場所が自動的に記録されます。" },
  feat_4_title: { en: "Emergency contact", mn: "Яаралтай холбоо", jp: "緊急連絡" },
  feat_4_p: { en: "One button connects a finder directly to the guardian, without exposing the number.", mn: "Нэг товчлуураар олсон хүнийг дугаарыг задруулахгүйгээр асран хамгаалагчид холбоно.", jp: "ワンボタンで発見者を保護者に直接つなぎます — 電話番号を明かすことはありません。" },
  feat_5_title: { en: "Student identification", mn: "Хүүхдийн танилт", jp: "生徒情報の確認" },
  feat_5_p: { en: "Name, school, class, and photo — available instantly to anyone who taps.", mn: "Нэр, сургууль, анги, зураг — товшсон хэн бүхэнд шууд харагдана.", jp: "名前・学校・学年・写真を、タップした方にすぐに表示します。" },
  feat_6_title: { en: "Parent notifications", mn: "Эцэг эхийн мэдэгдэл", jp: "保護者への通知" },
  feat_6_p: { en: "Parents check daily activity themselves — no separate app, just a phone number and a code.", mn: "Эцэг эх өдөр тутмын үйл ажиллагааг өөрөө шалгана — тусдаа апп хэрэггүй, зөвхөн утасны дугаар, код.", jp: "保護者は電話番号とワンタイムコードだけで、専用アプリなしに毎日の活動を確認できます。" },
  feat_7_title: { en: "School dashboard", mn: "Сургуулийн самбар", jp: "学校用ダッシュボード" },
  feat_7_p: { en: "Staff see every child's gate and scan activity in one place, filterable by class.", mn: "Ажилтнууд бүх хүүхдийн хаалга, уншилтын мэдээллийг нэг дороос ангиар шүүж харна.", jp: "教職員は全生徒の登下校・スキャン履歴を一つの画面で確認でき、学年ごとに絞り込みも可能です。" },
  feat_8_title: { en: "Secure by design", mn: "Аюулгүй загвар", jp: "設計段階からのセキュリティ" },
  feat_8_p: { en: "Profiles are locked — editing always requires a one-time code sent to the parent.", mn: "Мэдээлэл түгжээтэй — засахын тулд эцэг эхэд илгээсэн нэг удаагийн код үргэлж шаардлагатай.", jp: "プロフィール情報はロックされており、編集には必ず保護者に送られるワンタイムコードが必要です。" },
  feat_9_title: { en: "Durable & multilingual", mn: "Бат бөх, олон хэлтэй", jp: "耐久性と多言語対応" },
  feat_9_p: { en: "Full Mongolian, English, and Japanese support, built into a wristband durable enough to wear all day, every day.", mn: "Монгол, англи, япон хэлний бүрэн дэмжлэгтэй, өдөржин өмсөхөд зориулсан бат бөх силикон бугуйвч.", jp: "モンゴル語・英語・日本語に完全対応し、一日中着用しても耐えられる丈夫なシリコン製リストバンドです。" },
  how_eyebrow: { en: "How it works", mn: "Хэрхэн ажилладаг", jp: "使い方" },
  how_title: { en: "From wristband to reunited, in four steps", mn: "Бугуйвчнаас эхлээд дахин нэгдэх хүртэл дөрвөн алхам", jp: "リストバンド装着から再会まで、4つのステップ" },
  how_1_title: { en: "Wear", mn: "Өмсөх", jp: "装着" },
  how_1_p: { en: "The child wears the wristband, registered once by the school.", mn: "Хүүхэд бугуйвчийг өмсөнө, сургууль нэг удаа бүртгэнэ.", jp: "お子さまがリストバンドを装着し、学校が一度だけ登録します。" },
  how_2_title: { en: "Tap", mn: "Товших", jp: "タップ" },
  how_2_p: { en: "Anyone with a phone taps the wristband — no app required.", mn: "Утастай хэн ч бугуйвчийг товшино — апп хэрэггүй.", jp: "スマートフォンを持つ誰でもリストバンドにタップできます — アプリは不要です。" },
  how_3_title: { en: "Info appears", mn: "Мэдээлэл гарч ирнэ", jp: "情報を表示" },
  how_3_p: { en: "Name, school, and emergency details appear in the child's language.", mn: "Нэр, сургууль, яаралтай тусламжийн мэдээлэл хүүхдийн хэлээр гарч ирнэ.", jp: "名前・学校・緊急時の情報が、お子さまの言語で表示されます。" },
  how_4_title: { en: "Everyone's notified", mn: "Бүгд мэдэгдэнэ", jp: "全員に通知" },
  how_4_p: { en: "Guardians and school staff can see exactly what happened, and when.", mn: "Асран хамгаалагч, сургуулийн ажилтан юу болсныг, хэзээ болсныг харна.", jp: "保護者と学校スタッフは、何が起きたのか、いつ起きたのかを正確に確認できます。" },
  benefits_eyebrow: { en: "Benefits", mn: "Давуу тал", jp: "メリット" },
  benefits_title: { en: "Built for everyone around the child", mn: "Хүүхдийг тойрсон хүн бүрт зориулав", jp: "子どもを取り巻くすべての人のために" },
  tab_parents: { en: "Parents", mn: "Эцэг эх", jp: "保護者" },
  tab_schools: { en: "Schools", mn: "Сургууль", jp: "学校" },
  tab_teachers: { en: "Teachers", mn: "Багш", jp: "教員" },
  tab_admin: { en: "Administrators", mn: "Админ", jp: "管理者" },
  tab_parents_1: { en: "See exactly when your child arrived at and left school — automatically.", mn: "Хүүхэд тань сургуульд хэзээ ирж, явсныг автоматаар харна.", jp: "お子さまが登校・下校した時刻を自動的に、正確に確認できます。" },
  tab_parents_2: { en: "Your phone number is never shown to a finder — they connect through OneTag.", mn: "Таны утасны дугаар олсон хүнд хэзээ ч харагдахгүй — OneTag-ээр дамжина.", jp: "保護者の電話番号は発見者に表示されません — OneTagを通じて接続されます。" },
  tab_parents_3: { en: "No app to install — check activity from any phone browser with a one-time code.", mn: "Апп татах шаардлагагүй — ямар ч утсаар нэг удаагийн кодоор шалгаарай.", jp: "アプリのインストール不要 — ワンタイムコードでどのスマートフォンからでも確認できます。" },
  tab_schools_1: { en: "Gate arrival and departure are logged automatically — no manual sheets.", mn: "Хаалганы ирц, явцыг автоматаар бүртгэнэ — гар бүртгэл хэрэггүй.", jp: "校門での登下校が自動的に記録されます — 手作業の記録簿は不要です。" },
  tab_schools_2: { en: "One dashboard shows every child's activity, filterable by class.", mn: "Нэг самбараас бүх хүүхдийн үйл ажиллагааг ангиар шүүж харна.", jp: "一つのダッシュボードで全生徒の活動を確認、学年ごとに絞り込み可能です。" },
  tab_schools_3: { en: "Every admin account is scoped to its own school — no data crossover.", mn: "Админ бүр зөвхөн өөрийн сургуулийн мэдээллийг харна.", jp: "各管理者アカウントは自校のみに限定され、データが混在することはありません。" },
  tab_teachers_1: { en: "Know instantly which children are present without a roll call.", mn: "Ямар хүүхэд ирснийг нэрсийн жагсаалт уншихгүйгээр шууд мэднэ.", jp: "点呼をしなくても、どの生徒が登校しているか即座にわかります。" },
  tab_teachers_2: { en: "Emergency medical notes are one tap away in an actual emergency.", mn: "Яаралтай тусламжийн тэмдэглэл нэг товшилтын зайд байна.", jp: "緊急時の医療情報にワンタップでアクセスできます。" },
  tab_teachers_3: { en: "Less time on paperwork, more time with the children.", mn: "Цаасан ажил багасч, хүүхдэдээ илүү цаг зарцуулна.", jp: "事務作業が減り、子どもたちと過ごす時間が増えます。" },
  tab_admin_1: { en: "Manage every school, class, and admin account from one place.", mn: "Бүх сургууль, анги, админ бүртгэлийг нэг дороос удирдана.", jp: "すべての学校・学年・管理者アカウントを一箇所で管理できます。" },
  tab_admin_2: { en: "A clear audit trail of every gate tap and profile edit.", mn: "Хаалганы товшилт, мэдээлэл засварын тодорхой түүх.", jp: "校門でのタップやプロフィール編集の履歴を明確に確認できます。" },
  tab_admin_3: { en: "Add or remove school admins in minutes, not days.", mn: "Сургуулийн админыг хэдхэн минутанд нэмэх, хасах боломжтой.", jp: "学校管理者の追加・削除も数分で完了します。" },
  gallery_eyebrow: { en: "Gallery", mn: "Галерей", jp: "ギャラリー" },
  gallery_title: { en: "See OneTag in the real world", mn: "OneTag-ийг бодит амьдрал дээр харах", jp: "実際の利用シーンをご覧ください" },
  testimonial_eyebrow: { en: "Feedback", mn: "Санал хүсэлт", jp: "ご意見・ご感想" },
  testimonial_title: { en: "From families and schools", mn: "Гэр бүл, сургуулиудаас", jp: "ご家族・学校の声" },
  testimonial_placeholder_text: { en: "Real feedback from families and schools will appear here as more join OneTag.", mn: "Илүү олон гэр бүл, сургууль нэгдэхийн хэрээр бодит санал хүсэлт энд гарч ирнэ.", jp: "より多くのご家族・学校にご参加いただくことで、こちらに実際のご感想が掲載される予定です。" },
  faq_eyebrow: { en: "FAQ", mn: "Асуулт хариулт", jp: "よくある質問" },
  faq_title: { en: "Common questions", mn: "Түгээмэл асуултууд", jp: "よくあるご質問" },
  faq_1_q: { en: "Does a finder need to install an app?", mn: "Олсон хүн апп татах шаардлагатай юу?", jp: "発見した方はアプリをインストールする必要がありますか？" },
  faq_1_a: { en: "No. Tapping the wristband opens a normal web page in any browser — nothing to install.", mn: "Үгүй. Бугуйвчийг товшихад ямар ч хөтчөөр энгийн вэб хуудас нээгдэнэ — юу ч татах шаардлагагүй.", jp: "いいえ。リストバンドをタップすると、どのブラウザでも通常のウェブページが開きます — インストールは一切不要です。" },
  faq_2_q: { en: "Is our child's information safe?", mn: "Хүүхдийнхээ мэдээлэл аюулгүй юу?", jp: "子どもの情報は安全に管理されますか？" },
  faq_2_a: { en: "Only essential emergency details are public. Editing a profile always requires a one-time code sent to the parent, and the parent's phone number is never shown to a finder.", mn: "Зөвхөн зайлшгүй яаралтай мэдээлэл нээлттэй байна. Мэдээлэл засахын тулд эцэг эхэд илгээсэн нэг удаагийн код үргэлж шаардлагатай бөгөөд эцэг эхийн утасны дугаар олсон хүнд хэзээ ч харагдахгүй.", jp: "公開されるのは必要最低限の緊急情報のみです。プロフィールの編集には必ず保護者に送られるワンタイムコードが必要で、保護者の電話番号が発見者に表示されることはありません。" },
  faq_3_q: { en: "What happens if the wristband is lost?", mn: "Бугуйвч гээгдвэл яах вэ?", jp: "リストバンドを紛失した場合はどうなりますか？" },
  faq_3_a: { en: "A school admin can deactivate a lost tag and issue a new one from the dashboard in minutes.", mn: "Сургуулийн админ гээгдсэн тагийг хэдхэн минутанд идэвхгүй болгож, шинийг олгож болно.", jp: "学校管理者はダッシュボードから紛失したタグを数分で無効化し、新しいものを発行できます。" },
  faq_4_q: { en: "What does OneTag cost?", mn: "OneTag хэдэн төгрөг вэ?", jp: "OneTagの費用はどのくらいですか？" },
  faq_4_a: { en: "Pricing depends on the number of students and deployment scale. Contact us for a quote tailored to your school.", mn: "Үнэ сурагчийн тоо, хэрэгжүүлэх хэмжээнээс хамаарна. Тохирсон үнийн санал авахын тулд бидэнтэй холбогдоно уу.", jp: "料金は生徒数や導入規模によって異なります。貴校に合わせたお見積りについては、お気軽にお問い合わせください。" },
  faq_5_q: { en: "Which languages are supported?", mn: "Ямар хэл дэмждэг вэ?", jp: "どの言語に対応していますか？" },
  faq_5_a: { en: "OneTag is available in Mongolian, English, and Japanese today, with more languages planned.", mn: "OneTag өнөөдөр монгол, англи, япон хэлээр бүрэн ажилладаг бөгөөд цаашид өөр хэл нэмэгдэх төлөвтэй.", jp: "OneTagは現在、モンゴル語・英語・日本語に対応しており、今後さらに多くの言語に対応予定です。" },
  contact_h2: { en: "Bring OneTag to your school", mn: "OneTag-ийг сургуульдаа авчрах", jp: "学校にOneTagを導入する" },
  contact_p: { en: "OneTag is currently available for special-needs schools in Ulaanbaatar, with more schools launching soon. Reach out to book a demo, ask about pricing, or bring it to your school.", mn: "OneTag одоогоор Улаанбаатар хотын тусгай хэрэгцээт сургуулиудад ашиглах боломжтой бөгөөд удахгүй илүү олон сургуульд нэвтэрнэ. Демо захиалах, үнийн санал авах эсвэл сургуульдаа авчрахын тулд бидэнтэй холбогдоно уу.", jp: "OneTagは現在、ウランバートル市内の特別支援学校で導入されています。今後さらに多くの学校への展開を予定しています。デモのご予約、料金のお問い合わせ、導入のご相談などお気軽にご連絡ください。" },
  hero_btn_parent: { en: "I'm a parent", mn: "Би эцэг эх", jp: "保護者です" },
  hero_btn_staff: { en: "I'm school staff", mn: "Би сургуулийн ажилтан", jp: "学校スタッフです" },
  form_name: { en: "Name", mn: "Нэр", jp: "お名前" },
  form_org: { en: "School / Organization", mn: "Сургууль / Байгууллага", jp: "学校・団体名" },
  form_email: { en: "Email", mn: "И-мэйл", jp: "メールアドレス" },
  form_message: { en: "Message", mn: "Зурвас", jp: "メッセージ" },
  form_message_ph: { en: "Tell us about your school and what you're looking for...", mn: "Сургуулийнхаа болон хэрэгцээгээ бидэнд хэлнэ үү...", jp: "貴校の状況とご要望をお聞かせください…" },
  form_submit: { en: "Send message", mn: "Зурвас илгээх", jp: "送信する" },
  footer_desc: { en: "An NFC smart wristband for student safety — instant identification, emergency contact, real-time location, and attendance tracking.", mn: "Хүүхдийн аюулгүй байдлын NFC ухаалаг бугуйвч — шуурхай танилт, яаралтай холбоо, бодит цагийн байршил, ирц бүртгэл.", jp: "生徒の安全を守るNFCスマートリストバンド — 即時の身元確認、緊急連絡、リアルタイム位置情報、出席管理。" },
  footer_product: { en: "Product", mn: "Бүтээгдэхүүн", jp: "製品" },
  footer_access: { en: "Access", mn: "Нэвтрэх", jp: "アクセス" },
  footer_contact: { en: "Contact", mn: "Холбоо барих", jp: "お問い合わせ" }
};

// The scroll-story scenes, in original order (position 0-8). Each becomes
// one row in the story_scenes table (see db.js) — position, image, and a
// caption in all three languages. scene_type 'registration_hud' is the one
// scene (originally position 7) that also overlays the small HUD labels
// (Name/Allergies/Blood Type/...) on top of its photo; every other scene
// is a plain photo + caption. This is the ORIGINAL set only — once the
// super-admin dashboard adds, deletes, or reorders scenes, this file is
// never consulted again for that installation (see seedStorySceneDefaults
// in db.js, which only runs once against an empty table).
const STORY_SCENE_SEED = [
  { position: 0, image_url: '/assets/scene4-aerial.jpg', scene_type: 'photo',
    caption: { en: "Safe every school day. Found in seconds, wherever they are.", mn: "Сургуулийн өдөр бүр аюулгүй. Секундын дотор олдоно, хаана ч байсан.", jp: "毎日安心して登校。数秒で居場所がわかります。" } },
  { position: 1, image_url: '/assets/scene5-crane.jpg', scene_type: 'photo',
    caption: { en: "Another school morning begins.", mn: "Сургуулийн өглөө дахин эхэлж байна.", jp: "また学校の朝が始まります。" } },
  { position: 2, image_url: '/assets/scene7-tap-morning.jpg', scene_type: 'photo',
    caption: { en: "Tap at the school gate every morning...", mn: "Өглөө бүр сургуулийн хаалганд товшино...", jp: "毎朝、校門でタップ…" } },
  { position: 3, image_url: '/assets/scene8-dashboard.jpg', scene_type: 'photo',
    caption: { en: "The school knows the instant they're in.", mn: "Сургууль тэднийг ирсэн даруйд нь мэднэ.", jp: "登校した瞬間、学校はすぐに把握します。" } },
  { position: 4, image_url: '/assets/scene9-tap-dusk.jpg', scene_type: 'photo',
    caption: { en: "...and every afternoon.", mn: "...орой бүр мөн адил.", jp: "…そして毎日下校時にも。" } },
  { position: 5, image_url: '/assets/scene10-phone-notif.jpg', scene_type: 'photo',
    caption: { en: "Left safely. Parents know instantly.", mn: "Аюулгүй явлаа. Эцэг эх шууд мэднэ.", jp: "無事に下校。保護者はすぐに知ることができます。" } },
  { position: 6, image_url: '/assets/scene12-map.jpg', scene_type: 'photo',
    caption: { en: "In an emergency, one tap finds them in seconds — real-time GPS.", mn: "Онц үед нэг товшилтоор секундын дотор олно — бодит цагийн GPS.", jp: "緊急時も、ワンタップで数秒以内に位置を特定 — リアルタイムGPS。" } },
  { position: 7, image_url: '/assets/scene2-hud-v3.jpg', scene_type: 'registration_hud',
    caption: { en: "Everything that matters, saved in seconds.", mn: "Хэрэгтэй бүх мэдээлэл секундын дотор хадгалагдана.", jp: "大切な情報を、数秒で記録。" } },
  { position: 8, image_url: '/assets/scene1-product.jpg', scene_type: 'photo',
    caption: { en: "One wristband. Every school day.", mn: "Нэг бугуйвч. Сургуулийн өдөр бүр.", jp: "一つのリストバンドで、毎日の学校生活を。" } }
];

// These 9 keys used to be the story captions before scenes got their own
// caption_mn/en/jp columns (see above). They're left in TEXT_SEED so an
// in-progress edit from the very first version of this dashboard isn't
// silently lost, but the admin Text tab hides them now — editing one here
// would no longer do anything, since home.html reads story captions from
// story_scenes instead.
const RETIRED_TEXT_KEYS = ['hero_h1', 'story_crane', 'intro_2', 'story_8', 'intro_3', 'story_10', 'intro_5', 'story_2', 'story_close_product'];

// Whole sections/cards/items that can be hidden from the live site without
// touching code. Scoped to repeatable content units and top-level sections
// — not literally every element — so the dashboard stays usable. The hero
// story itself, and the Contact section, are intentionally NOT included:
// hiding either would break the page's core purpose.
const BLOCK_SEED = [
  { key: 'section_post_story_ctas', label: 'Buttons row right after the story' },
  { key: 'section_stats', label: 'Section: "Why this matters" stats' },
  { key: 'stat_a', label: 'Stat: people living with disabilities' },
  { key: 'stat_b', label: 'Stat: children with disabilities nationwide' },
  { key: 'stat_c', label: 'Stat: road injuries in a year' },
  { key: 'section_gps_demo', label: 'Section: Real-time GPS demo' },
  { key: 'section_features', label: 'Section: Features' },
  { key: 'feat_1', label: 'Feature card: Real-time GPS' },
  { key: 'feat_2', label: 'Feature card: NFC technology' },
  { key: 'feat_3', label: 'Feature card: Attendance tracking' },
  { key: 'feat_4', label: 'Feature card: Emergency contact' },
  { key: 'feat_5', label: 'Feature card: Student identification' },
  { key: 'feat_6', label: 'Feature card: Parent notifications' },
  { key: 'feat_7', label: 'Feature card: School dashboard' },
  { key: 'feat_8', label: 'Feature card: Secure by design' },
  { key: 'feat_9', label: 'Feature card: Durable & multilingual' },
  { key: 'section_how_it_works', label: 'Section: How it works' },
  { key: 'how_1', label: 'Step 1: Wear' },
  { key: 'how_2', label: 'Step 2: Tap' },
  { key: 'how_3', label: 'Step 3: Info appears' },
  { key: 'how_4', label: 'Step 4: Everyone’s notified' },
  { key: 'section_benefits', label: 'Section: Benefits (tabs)' },
  { key: 'benefits_tab_parents', label: 'Benefits tab: Parents' },
  { key: 'benefits_tab_schools', label: 'Benefits tab: Schools' },
  { key: 'benefits_tab_teachers', label: 'Benefits tab: Teachers' },
  { key: 'benefits_tab_admin', label: 'Benefits tab: Administrators' },
  { key: 'section_gallery', label: 'Section: Gallery' },
  { key: 'section_faq', label: 'Section: FAQ' },
  { key: 'faq_1', label: 'FAQ: Does a finder need an app?' },
  { key: 'faq_2', label: 'FAQ: Is our child’s information safe?' },
  { key: 'faq_3', label: 'FAQ: What if the wristband is lost?' },
  { key: 'faq_4', label: 'FAQ: What does OneTag cost?' },
  { key: 'faq_5', label: 'FAQ: Which languages are supported?' }
];

module.exports = { TEXT_SEED, STORY_SCENE_SEED, RETIRED_TEXT_KEYS, BLOCK_SEED };
