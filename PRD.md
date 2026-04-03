# Ürün Gereksinimleri Belgesi (PRD) - Jira Release Reporter

## 1. Ürün Özeti
**Jira Release Reporter**, Jira üzerinden dışa aktarılan (export) karmaşık yayın/onay (release) kayıtlarının (HTML veya Excel formatlarında) otomatik olarak ayrıştırılarak kurumsal standartlara uygun, temiz, okunabilir ve hızlıca paylaşılabilir Sürüm Notları (Release Notes) formatına dönüştürülmesini sağlayan web tabanlı, statik bir Frontend (Vite + React) uygulamasıdır.

## 2. Kullanıcı Hedefi ve Problemler
Ekiplerin Jira üzerinden alınan listeleri manuel olarak düzenleyip e-postaya veya PDF'e dönüştürmesi büyük bir zaman kaybı ve hata riskidir. Bu uygulama;
- Sürüm bilgilerini (Epic, Talepler, Bug kayıtları) otomatik kategorize eder.
- Kayıtların platformlarını (iOS/Android vb.) otomatik tespit eder.
- Mail (Örn: Outlook) dostu tablo sistemleri üretir.
- Tarihsel filtreleme sayesinde (örneğin önceki bir pakette gönderilen gelişmeleri) ayırır ve farklı bir renkte (gri/soluk) vurgulayarak mükerrer test/kontrol eforunu engeller.
- Kritik alanların rapor üzerinden doğrudan düzenlenmesine olanak sunar.

## 3. Temel Özellikler (Mevcut Durum - v2.5.2)
Aşağıdaki fonksiyonel gereksinimler hâlihazırda uygulamada çalışır durumdadır:

### 3.1. Veri Yükleme ve Akıllı Ayrıştırma (Parsing)
- **Çoklu Format Desteği:** Jira'dan alınan hem `HTML` hem de `Excel (.xls, .xlsx)` dosyalarını kabul edip okuyabilir.
- **Kategori Ayrımı:**
  - **Talepler (Story/Task/Sub-task):** \"Bug\" sınıfında olmayan ve \"CCRSP\" ID'sine sahip kayıtlarla birlikte, Task ve Sub-task türleri (CCRSP numarası olmasa dahi tire `-` atanarak) \"Talepler\" tablosuna aktarılır.
  - **Tamamlanan Kayıtlar (Bugs):** Issue Type \"Bug\" olanlar veya etiket/açıklama metninde `\"external\"` veya `\"accessibilitybug\"` barındıran veya dış sistem (Örn: ISCEPEXTRC) bağlantısı bulunan kayıtlar otomatik olarak süzülüp hata çözümleri listesinde yer alır.
- **Akıllı Backlog ve Defect ID Taraması:** Karmaşık metin hücreleri arasından Regex ile doğru \"CCRSP\" veya \"ISCEPEXTRC / ISCOREXT\" referansları tespit edilir. Tüm tablolarda öncelik \"CCRSP\" numarasına aittir; yoksa \"ISCEPEXTRC/ISCOREXT\"; hiçbiri yoksa \"-\" gösterilir.
- **Epic Birleştirme:** Aynı \"Epic Name\" altındaki bağıntılı talepler, tabloda `rowSpan` yapılarak tekil ve temiz biçimde birleştirilir.
- **Platform Tespit Sistemi:** Orijinal bilet kodlarındaki (örn: ISCEPANDROID, ISCEPIPHONE) ifadelere bakılarak platform (iOS / Android) otomatik tespit edilir.
- **Release Notes Ayrıştırma:** Jira'daki `customfield_10082` (Release Notes) veya "Sürüm Notu" (Case-insensitive) alanı, HTML ve Excel exportlarında otomatik okunur. `#` ile başlayan teknik alt detaylar filtrelenir; geçerli notlar Kısım B'ye aktarılır.

### 3.2. Arayüz ve UI/UX Davranışları
- **Filtreleme & Uyarı Mekanizması:** \"Tarih Bazlı Filtrele\" ile o tarihten önce çözülmüş taskların arka planı soluk gri yapılır.
- **Akıllı Uyarı Ekranları (Modals):** Filtre girilmeden dışa aktarım istendiğinde doğrulama pop-up'ı gösterilir.
- **Bildirimler:** Başarı/hata bildirimleri gösterilir, sayfa başına otomatik kaydırma yapılır.
- **Düzenlenebilir (Editable) Rapor Alanları:** Oluşturulan raporda belirli alanlar, tablo formatını ve ölçülerini bozmadan doğrudan düzenlenebilir:
  - **Sürüm Bilgisi (Kısım A):** Sürüm numarası tıklanarak değiştirilebilir.
  - **Tamamlanan Kayıtlar – Açıklama:** Her hata kaydının açıklaması satır satır düzenlenebilir.
  - **Belirtilmesi Gerekenler (Kısım B):** Jira Release Notes'tan otomatik doldurulur (bold özet + normal açıklama formatında). İçerik serbestçe düzenlenebilir.
  - **Bilinen Durumlar (Kısım B):** Boş olarak gelir, kullanıcı serbest metin girebilir.
  - **Paket URL Notu (Kısım C):** Varsayılan uyarı metni ile gelir (`Paket linkini ekle ve paketi BETA'lamayı...`), düzenlenebilir, mavi-italik stilinde gösterilir.

### 3.3. Belirtilmesi Gerekenler – Release Notes Entegrasyonu
- Dosya yüklendiğinde, Jira'dan gelen ve `None` veya boş olmayan Release Notes değerleri otomatik olarak ayrıştırılır.
- `#` ile başlayan teknik iç notlar (test adımları, sub-bullet'lar) filtrelenerek dışarıda bırakılır.
- Her kayıt şu formatta listelenir: **`• [Task Açıklaması]`** `: [Release Notes]` (Summary **kalın**, açıklama normal)
- Alan `contentEditable` div olarak render edilir — kullanıcı otomatik gelen içeriği düzenleyebilir veya silip sıfırdan yazabilir.
- Bu içerik hem PDF'e hem Mail Kopyası'na yansır.

### 3.4. Dışa Aktarım (Export) Modülleri
- **PDF İndir (html2pdf):** Sayfanın anlık UI görüntüsünü A4 formatlı PDF belgesine dönüştürür. Editable alanlardaki son hali PDF'e yansır.
- **Mail İçin Kopyala:** MS Outlook ve Mac Mail'de bozuma uğramayan özel HTML formatında panoya kopyalar. Editable alanlardaki (Sürüm, Açıklamalar, Belirtilmesi Gerekenler, Bilinen Durumlar, Paket URL) tüm düzenlemeler mail kopyasına yansır.

## 4. Versiyon Geçmişi (Özet)
| Versiyon | Tarih | Değişiklik |
|---|---|---|
| v2.3.2 | 13.03.2026 | ID öncelik sırası (CCRSP > ISCEPEXTRC > -) |
| v2.4.0 | 17.03.2026 | Sürüm bilgisi ve Paket URL editable yapıldı |
| v2.5.0 | 18.03.2026 | Release Notes ayrıştırma + Belirtilmesi Gerekenler otomatik doldurma |
| v2.5.1 | 18.03.2026 | `#` satır filtresi eklendi |
| v2.5.2 | 18.03.2026 | Bold summary formatı, Bilinen Durumlar editable, PRD güncellendi |
| v2.5.3 | 28.03.2026 | Dify workflow fix, AI tool fixes |
| v2.5.4 | 01.04.2026 | Release Notes içerisindeki liste (bullet) ve formatlama yapılarının birebir (HTML tag olarak) korunarak rapora (ve e-postaya) yansıması sağlandı |
| v2.5.5 | 03.04.2026 | Dışa aktarılan listede bulunan "Bug" ve eşleştiği "CCRSP" var ise; hata özetinin otomatik olarak CCRSP'nin kendi başlığı (summary) ile ezilmesi (çapraz eşleşme) kurgulandı |
| v2.5.6 | 03.04.2026 | Tamamlanan kayıtlarda anahtar/ID önceliği kesinleştirildi: ISCEPIPHONE/ISCEPANDROID vb. biletlerin içinde CCRSP varsa 'Defect ID' olarak o kullanılır; yoksa ISCEPEXTRC/ISCOREXT; ikisi de yoksa '-' setlenir. |
| v2.5.7 | 03.04.2026 | Tamamlanan kayıtlar açıklaması satıra sığmama sorunu word-wrap ile çözüldü. CCRSP başlığı tablodan eşleşmese bile artık hücredeki metin (html/excel) üzerinden zorla süzülüp alınabiliyor. |
| v2.5.8 | 03.04.2026 | Giriş sayfasındaki bilgilendirme metinleri güncellendi (Jira filter sayfalarından Export/HTML report - filter fields formatı için uyarı eklendi, uzantı uyarıları kaldırıldı). Uygulama Prod ortamına deploy edildi. |
| v2.5.9 | 03.04.2026 | React 19 contentEditable state crash (beyaz ekran) problemi auto-resizing textarea componenti kullanılarak çözüldü. |

---
*(Kural: Bu doküman, uygulamada yapılan her teknik, fonksiyonel ve süreç bazlı değişiklikte tıpkı versiyon dosyası gibi otomatik olarak güncellenecektir.)*
<br/>
**Son Güncelleme:** v2.5.9 - 03.04.2026
