# dsh-cam-plugin

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [العربية](README.ar.md)

يربط [cam](https://github.com/HanochZhu/codeagent_memory) المحلي (code agent memory: مخطط الشيفرة وذاكرة الحلول داخل المشروع) بـ [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH، بيئة تشغيل الوكلاء من DeepSeek).

يستدعي الملحق الأمر المحلي `cam --json`. تبقى الذاكرة ومخطط الشيفرة في `.cam/cam.db` داخل المشروع المستهدف، ولا تُرفع إلى أي خادم.

## المتطلبات

يجب أن يكون `cam` على `PATH` وأن يعمل `cam --help`. هذه الحزمة لا تتضمّن الملف التنفيذي.

## التثبيت

```sh
dsh plugin --profile <profile> add github:HanochZhu/dsh-cam-plugin
```

نقطة الدخول ESM خالصة، لذلك لا يشغّل التثبيت سكربت بناء. ابدأ Harness بهذا الملف الشخصي:

```sh
dsh --profile <profile>
```

يعرض `--dump-config` طبقة باسم `# == dsh-cam-plugin`.

لتثبيت مسار الملف التنفيذي أو المشروع الافتراضي، استبدل الصف ذا المعرّف `cam` في `cordis.patch.yml` الخاص بالملف الشخصي. هذه الطبقة تستبدل قيمة `config` كاملة:

```yaml
- id: cam
  config:
    camBin: cam
    project: D:/work/my-repo
```

يمكن حذف `project`. كل أداة تقبل `path`. إذا غاب الاثنان، يستخدم cam المتغير `CAM_PROJECT`، ثم يصعد من مجلد عمل العملية بحثًا عن `.cam` أو `.git`.

لتجربة نسخة غير مثبّتة كحزمة:

```sh
dsh web --patch ./cordis.example.yml
```

يجب أن يكون مسار الملحق في `cordis.example.yml` مسارًا مطلقًا.

## الأدوات

| الأداة | الدور |
| --- | --- |
| `cam_recall` | البحث في ذاكرة الحلول بجملة إنجليزية واحدة |
| `cam_index` | بناء المخطط مرة واحدة، ثم تحديثه تدريجيًا |
| `cam_ls` / `cam_find` / `cam_grep` | عرض مجلد، أو البحث باسم الرمز، أو البحث عن نص حرفي |
| `cam_read` / `cam_ref` | قراءة رمز واحد، أو عرض المستدعين (`in`) والمستدعَين (`out`) |
| `cam_add` / `cam_mem_show` / `cam_mem_tree` | حفظ ذاكرة واحدة، أو عرضها بالمعرّف، أو طباعة الشجرة |
| `cam_status` | عرض المشروع الذي تم حله وقاعدة البيانات |

إذا وفّر Harness خدمة المهارات، يسجّل الملحق مهارة وقت التشغيل `cam`. خطواتها تطابق هذه الأدوات.

## التطوير

```sh
npm test
```
