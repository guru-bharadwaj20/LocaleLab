/*
 * A tiny client-side i18n shim for the demo storefront.
 *
 * It picks a dictionary from navigator.language, sets <html lang> and dir,
 * swaps text into every [data-i18n] element and formats a few values with
 * the browser's Intl APIs. Keys that no dictionary knows fall back to the
 * key itself, which is exactly how raw keys leak into real products.
 */
(function () {
  "use strict";

  var dictionaries = {
    en: {
      "nav.shop": "Shop",
      "nav.stories": "Stories",
      "nav.support": "Support",
      "nav.cart": "Cart",
      "hero.eyebrow": "Winter collection",
      "hero.title": "Built for the cold months ahead",
      "hero.lede": "Insulated layers, waterproof shells and boots tested on the trail.",
      "hero.saleEnds": "Sale ends",
      "shipping.badge": "Free shipping over $50",
      "products.title": "Featured gear",
      "products.parka": "Recycled down fill, rated to -20 degrees.",
      "products.shell": "Three-layer waterproof fabric with pit zips.",
      "products.boots": "Vibram sole and a full-grain leather upper.",
      "trust.reviews": "kilometres walked by our testers",
      "trust.members": "members in the repair programme",
      "trust.delivery": "last order date for holiday delivery",
      "checkout.title": "Ready when you are",
      "checkout.body": "Your cart is saved across devices. Pay with card, PayPal or bank transfer.",
      "footer.privacy": "Privacy",
      "footer.terms": "Terms",
      "footer.contact": "Contact"
    },
    de: {
      "nav.shop": "Shop",
      "nav.stories": "Geschichten",
      "nav.support": "Hilfe",
      "nav.cart": "Warenkorb",
      "hero.eyebrow": "Winterkollektion",
      "hero.title": "Gemacht für die kalten Monate",
      "hero.lede": "Isolierende Schichten, wasserdichte Jacken und Stiefel, getestet auf dem Trail.",
      "hero.saleEnds": "Angebot endet am",
      "shipping.badge": "Kostenloser Versand ab 50 $ Bestellwert",
      "products.title": "Ausgewählte Ausrüstung",
      "products.parka": "Recycelte Daunenfüllung, geeignet bis -20 Grad.",
      "products.shell": "Dreilagiges wasserdichtes Material mit Belüftungsreißverschlüssen.",
      "products.boots": "Vibram-Sohle und Obermaterial aus Vollnarbenleder.",
      "trust.reviews": "Kilometer, die unsere Tester gelaufen sind",
      "trust.members": "Mitglieder im Reparaturprogramm",
      "trust.delivery": "letzter Bestelltag für die Lieferung zu den Feiertagen",
      "checkout.title": "Bereit, wenn Sie es sind",
      "checkout.body": "Ihr Warenkorb wird geräteübergreifend gespeichert. Zahlen Sie per Karte, PayPal oder Überweisung.",
      "footer.privacy": "Datenschutz",
      "footer.terms": "AGB",
      "footer.contact": "Kontakt"
    },
    ja: {
      "nav.shop": "ショップ",
      "nav.stories": "ストーリー",
      "nav.support": "サポート",
      "nav.cart": "カート",
      "hero.eyebrow": "冬のコレクション",
      "hero.title": "寒い季節のために作られた",
      "hero.lede": "保温レイヤー、防水シェル、トレイルでテストされたブーツ。",
      "hero.saleEnds": "セール終了日",
      "shipping.badge": "50ドル以上で送料無料",
      "products.title": "注目のギア",
      "products.parka": "リサイクルダウン使用。-20度対応。",
      "products.shell": "ピットジップ付きの3レイヤー防水素材。",
      "products.boots": "ビブラムソールとフルグレインレザーのアッパー。",
      "trust.reviews": "テスターが歩いた距離（km）",
      "trust.members": "修理プログラムの会員数",
      "trust.delivery": "ホリデー配達の最終注文日",
      "checkout.title": "準備ができたら",
      "checkout.body": "カートはデバイス間で保存されます。カード、PayPal、銀行振込でお支払いいただけます。",
      "footer.privacy": "プライバシー",
      "footer.terms": "利用規約",
      "footer.contact": "お問い合わせ"
    },
    ar: {
      "nav.shop": "المتجر",
      "nav.stories": "قصص",
      "nav.support": "الدعم",
      "nav.cart": "السلة",
      "hero.eyebrow": "مجموعة الشتاء",
      "hero.title": "مصممة للأشهر الباردة القادمة",
      "hero.lede": "طبقات عازلة وستر مقاومة للماء وأحذية جربناها على المسارات.",
      "hero.saleEnds": "ينتهي التخفيض في",
      "shipping.badge": "شحن مجاني للطلبات التي تتجاوز 50 دولاراً",
      "products.title": "معدات مميزة",
      "products.parka": "حشوة ريش معاد تدويرها، مناسبة حتى -20 درجة.",
      "products.shell": "قماش مقاوم للماء من ثلاث طبقات مع سحابات تهوية.",
      "products.boots": "نعل فيبرام وجزء علوي من الجلد الكامل.",
      "trust.reviews": "كيلومترات سارها مختبرونا",
      "trust.members": "عضواً في برنامج الإصلاح",
      "trust.delivery": "آخر موعد للطلب للتسليم في العطلات",
      "checkout.title": "جاهزون عندما تكون مستعداً",
      "checkout.body": "يتم حفظ سلتك عبر الأجهزة. ادفع بالبطاقة أو PayPal أو التحويل البنكي.",
      "footer.privacy": "الخصوصية",
      "footer.terms": "الشروط",
      "footer.contact": "اتصل بنا"
    }
  };

  var rtl = { ar: true, he: true, fa: true, ur: true };

  function pickLanguage(tag) {
    var primary = String(tag || "en").toLowerCase().split(/[-_]/)[0];
    return dictionaries[primary] ? primary : "en";
  }

  var locale = navigator.language || "en-US";
  var lang = pickLanguage(locale);
  var dict = dictionaries[lang];

  document.documentElement.lang = lang;
  document.documentElement.dir = rtl[lang] ? "rtl" : "ltr";

  var nodes = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute("data-i18n");
    var value = dict[key];
    if (value === undefined) value = dictionaries.en[key];
    if (value === undefined) value = key; // the classic leak
    nodes[i].textContent = value;
  }

  // Values the page formats properly, using the browser's own locale data.
  var currency = document.querySelectorAll("[data-fmt-currency]");
  for (var c = 0; c < currency.length; c++) {
    var parts = currency[c].getAttribute("data-fmt-currency").split(":");
    currency[c].textContent = new Intl.NumberFormat(locale, { style: "currency", currency: parts[0] }).format(Number(parts[1]));
  }
  var numbers = document.querySelectorAll("[data-fmt-number]");
  for (var n = 0; n < numbers.length; n++) {
    numbers[n].textContent = new Intl.NumberFormat(locale).format(Number(numbers[n].getAttribute("data-fmt-number")));
  }
  var dates = document.querySelectorAll("[data-fmt-date]");
  for (var d = 0; d < dates.length; d++) {
    var iso = dates[d].getAttribute("data-fmt-date");
    var parsed = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date(iso);
    var options = { dateStyle: "medium" };
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) options.timeZone = "UTC";
    dates[d].textContent = new Intl.DateTimeFormat(locale, options).format(parsed);
  }
})();
