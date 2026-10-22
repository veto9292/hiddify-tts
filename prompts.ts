
export const DEFAULT_TEXT = `# به Hiddify TTS خوش آمدید 🎧

این برنامه برای ایجاد تحول در نحوه شنیدن محتوای متنی طراحی شده است. به جای انتظار برای پردازش یک متن طولانی، Hiddify TTS از رویکرد **شبه-استریمینگ (Pseudo-Streaming)** استفاده می‌کند.

## 🚀 ویژگی‌های کلیدی

۱. **پخش فوری**: ما اولویت را به پاراگراف اول می‌دهیم تا بتوانید بلافاصله شروع به شنیدن کنید.
۲. **قطعه‌بندی هوشمند**: هوش مصنوعی ساختار متن شما را تحلیل می‌کند و اطمینان حاصل می‌کند که مکث‌ها در مرزهای طبیعی جملات اتفاق می‌افتند.
۳. **تلفظ دقیق**: تمام کلمات انگلیسی به صورت خودکار به معادل فارسی (فینگلیش) تبدیل می‌شوند تا روانی کلام حفظ شود. همچنین کلمات دشوار با اعراب‌گذاری دقیق تلفظ می‌شوند.

## 🇮🇷 پشتیبانی کامل از فارسی

این سیستم به گونه‌ای طراحی شده است که متون فارسی را با دقت و شیوایی کامل بخواند. 

برای مثال:
- کلمه **"Docker"** به صورت **"داکِر"** خوانده می‌شود.
- کلمه **"Target"** به صورت **"تارگِت"** خوانده می‌شود.
- کلمات دوپهلو مانند **"گل"** با توجه به جمله به صورت **"گُل"** یا **"گِل"** اعراب‌گذاری می‌شوند.

> "تکنولوژی زمانی بهترین است که مردم را به هم نزدیک کند."
> — مت مولنوگ

کافیست متن ساده یا **Markdown** خود را اینجا جایگذاری کنید و دکمه **Generate & Play** را بزنید.
`;

export const DEFAULT_SYSTEM_INSTRUCTION = `Role: Expert Text-to-Speech Preprocessor for Persian.

Objective: Convert the input text into a JSON Array of short segments optimized for a Persian TTS engine. The output must be 100% in Persian script.

**CRITICAL RULES:**

1. **Language & Transliteration (Finglish)**:
   - **NO LATIN CHARACTERS**: You must transliterate ALL English/Latin words into their Persian phonetic equivalent.
   - **Examples**:
     - "Docker" → "داکِر"
     - "Target" → "تارگِت"
     - "API" → "اِی پی آی"
     - "React" → "ری‌اَکت"

2. **Pronunciation & Diacritics (Harakat)**:
   - **Disambiguation**: You MUST add Persian diacritics (Short Vowels: َ ِ ُ ّ ً) to words that look alike but sound different (Homographs).
   - **Examples**:
     - "کشت" → write "کِشت" (planting) or "کُشت" (killed) based on context.
     - "گل" → write "گُل" (flower) or "گِل" (mud).
     - "پر" → write "پُر" (full) or "پَر" (feather).

3. **Formatting Fixes**:
   - **Silent He**: Detach suffixes from words ending in "Silent He" (e.g., convert "خانه‌ای" to "خانه ای").
   - **Remove ZWNJ**: Replace all Zero-Width Non-Joiners (نیم‌فاصله) with standard spaces.
   - **Numbers**: Convert numbers to full Persian text (e.g., "1403" → "هزار و چهارصد و سه").

4. **Segmentation**:
   - Split text into logical segments (approx. 300-400 characters).
   - Ensure breaks occur at natural pauses.

5. **Code Handling**:
   - **Ignore Syntax**: Do NOT read code symbols (curly braces, semi-colons).
   - **Narrate Intent**: Briefly summarize what the code does in Persian.`;
