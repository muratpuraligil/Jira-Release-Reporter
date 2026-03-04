# Ürün Gereksinimleri Belgesi (PRD) - Jira Release Reporter

## 1. Ürün Özeti
**Jira Release Reporter**, Jira üzerinden dışa aktarılan (export) karmaşık yayın/onay (release) kayıtlarının (HTML veya Excel formatlarında) otomatik olarak ayrıştırılarak kurumsal standartlara uygun, temiz, okunabilir ve hızlıca paylaşılabilir Sürüm Notları (Release Notes) formatına dönüştürülmesini sağlayan web tabanlı, statik bir Frontend (Vite + React) uygulamasıdır.

## 2. Kullanıcı Hedefi ve Problemler
Ekiplerin Jira üzerinden alınan listeleri manuel olarak düzenleyip e-postaya veya PDF'e dönüştürmesi büyük bir zaman kaybı ve hata riskidir. Bu uygulama;
- Sürüm bilgilerini (Epic, Talepler, Bug kayıtları) otomatik kategorize eder.
- Kayıtların platformlarını (iOS/Android vb.) otomatik tespit eder.
- Mail (Örn: Outlook) dostu tablo sistemleri üretir.
- Tarihsel filtreleme sayesinde (örneğin önceki bir pakette gönderilen gelişmeleri) ayırır ve farklı bir renkte (gri/soluk) vurgulayarak mükerrer test/kontrol eforunu engeller.

## 3. Temel Özellikler (Mevcut Durum - v2.3.0)
Aşağıdaki fonksiyonel gereksinimler hâlihazırda uygulamada çalışır durumdadır:

### 3.1. Veri Yükleme ve Akıllı Ayrıştırma (Parsing)
- **Çoklu Format Desteği:** Jira'dan alınan hem `HTML` hem de `Excel (.xls, .xlsx)` dosyalarını kabul edip okuyabilir.
- **Kategori Ayrımı:**
  - **Talepler (Story/Task/Sub-task):** "Bug" sınıfında olmayan ve "CCRSP" ID'sine sahip kayıtlarla birlikte, Task ve Sub-task türleri (CCRSP numarası olmasa dahi tire `-` atanarak) "Talepler" tablosuna aktarılır.
  - **Tamamlanan Kayıtlar (Bugs):** Issue Type "Bug" olanlar veya dış sistem (Örn: ISCEPEXTRC) bağlantısı bulunup metninde bug barındıranlar otomatik olarak süzülüp hata çözümleri listesinde yer alır.
- **Akıllı Backlog ve Defect ID Taraması:** Karmaşık metin hücreleri arasından Regex ile doğru "CCRSP" veya "ISCEPEXTRC / ISCOREXT" referansları tespit edilip ilgili tıklanabilir Jira linklerine dönüştürülür.
- **Epic Birleştirme:** Aynı "Epic Name" altındaki bağıntılı talepler, tabloda `rowSpan` yapılarak tekil ve temiz bir biçimde birleştirilir.
- **Platform Tespit Sistemi:** Orijinal bilet kodlarındaki (örn: ISCEPANDROID, ISCEPIPHONE) ifadelere bakılarak dokümanın sol alanına ve paket tablosuna projenin ortamı (iOS / Android) otomatik yazılır.

### 3.2. Arayüz ve UI/UX Davranışları
- **Filtreleme & Uyarı Mekanizması:** "Tarih Bazlı Filtrele" seçeneği ile kullanıcı sisteme bir tarih verdiğinde o tarihten önce çözülmüş/güncellenmiş taskların arkaplanı soluk gri (`#334155`) yapılır. Böylece mail alıcısı nelerin yeni test edilmesi gerektiğini anlar.
- **Akıllı Uyarı Ekranları (Modals):** Kullanıcı filtre girmeden doğrudan dışa aktarım almak istediğinde uyarıcı bir Pop-up penceresi ("Yine de İşleme Devam Et" / "TAMAM") ile süreci doğrulatır ("TAMAM" dendiğinde scroll otomatik filtre tablosuna kayar).
- **Bildirimler:** Tüm kayıtların kopyalandığını bildiren yeşil başarı bildirimleri gösterilir ve eşzamanlı olarak sayfanın başına çıkılır (instant scroll).

### 3.3. Dışa Aktarım (Export) Modülleri
- **PDF İndir (html2pdf):** Sayfanın anlık anlık UI görüntüsünü kırpılmadan ve sorunsuz (epic satır kaymaları önlenmiş şekilde) A4 formatlı PDF belgesine dönüştürür.
- **Mail İçin Kopyala:** MS Outlook ve Mac Mail dahil e-posta istemcilerinde bozuma uğramayacak özel üretim (custom CSS injection - tablolara hapsedilmiş HTML) formatında Pano'ya (Clipboard) kayıtları kopyalar. (Bilgi sembolünün bile e-postada hatasız daire çizmesi için min-width sınırlamaları içerir).

## 4. Gelecek Geliştirmeler (Roadmap / Backlog)
- **(Beklemede) Dinamik Sürüm Notları ("Belirtilmesi Gerekenler"):** Jira üzerinde tüm BT (IT) ekibinin kullanabileceği özel bir `Release Notes` (Sürüm Notu) alanı açılacak. Uygulama, dosya yüklendiğinde bu alanı okuyarak Jira ID'leri ile birlikte `Kısım B: Sürüm Detayları - Belirtilmesi Gerekenler` alanına satır satır bu açıklamaları dinamik olarak enjekte edecek. (Böylece takımdaki her üyenin kendi geliştirmesine bıraktığı not, sürüm e-postasında şablona tam oturacak.)

---
*(Kural: Bu doküman, uygulamada yapılan her teknik, fonksiyonel ve süreç bazlı değişiklikte [örn. prod güncellemeleri] tıpkı versiyon dosyası gibi otomatik olarak güncellenecektir.)*
<br/>
**Son Güncelleme:** v2.3.0 - 04.03.2026
