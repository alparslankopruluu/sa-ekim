# Ayna — Review, Kararlar & Task Durumu (2026-07-21)

Yönetim özeti. İki uygulamalı ekosistem: **salonbook** (müşteri, repo `kprl884/salonbook`) ve **salonpro_business** (salon sahibi, repo `alparslankopruluu/salonpro_business`). İkisi de aynı Firebase projesine (`ayna-ec351`) yazar, aynı Firestore koleksiyonlarını paylaşır. Dev/prod ayrımı yok.

Bağlam: berberlere pilot öncesi UI/UX + güvenlik + business review yapıldı; kritik düzeltmeler ve 3 yeni yön uygulandı.

---

## Mimari kısıt (unutma)
`firestore.rules` VE `storage.rules` iki repoda **birebir aynı** tutulmalı. Rules/indexes deploy'u tam replace'tir — **son deploy kazanır**. Bir repodan deploy diğerini ezer.

---

## Yapılan işler (kod tamam, branch'ler push edildi)

### salonbook — branch `fix/booking-trust-and-security`
| # | İş | Durum |
|---|----|-------|
| U1 | Onay ekranı her randevuda sabit "Güzellik Merkezi Elit / Bağdat Cad. 123" gösteriyordu → gerçek salon (ad/adres/telefon) `businesses` dokümanından yüklenir, boş satır gizlenir | ✅ |
| U2 | "Yeniden planla" ikinci randevu yaratıyordu → gerçek reschedule: yeni randevu başarıyla oluşunca eski iptal edilir (vazgeçilirse eski güvende) | ✅ |
| S1 | `storage.rules` business ile birebir eşitlendi | ✅ |
| S2 | `env.json` takipten çıkarıldı + gitignore | ✅ (anahtar rotasyonu + geçmiş temizliği manuel) |
| — | `firestore.rules`: cash_entries + staff_attendance eklendi (senkron) | ✅ |

### salonpro_business — branch `feat/kasa-mesai-freemium-pilot`
| # | İş | Durum |
|---|----|-------|
| U6 | Ciro `$` (dolar) gösteriyordu → `₺` | ✅ |
| Pro-gate | Randevu onaylama artık **freemium** (deneme sonrası hard-block kaldırıldı); para analiz/kampanya/SMS/kapora'da toplanacak | ✅ |
| B1 | **Kasa** (`features/financials`): tek `cash_entries` ledger'ı (gelir+gider), günlük nakit/kart/gider + net, gün navigasyonu, ekle/sil. Önceden feature sadece ölü entity stub'ıydı | ✅ |
| B2 | **Mesai** (`features/attendance`): personel giriş/çıkış (clock-in/out), "kim içeride" görünümü, açık vardiya tek stream'den türetilir | ✅ |
| — | rules + composite index (businessId+date, businessId+clockInAt) + storage.rules senkron | ✅ |

Hepsi `flutter analyze` temiz. Erişim: Profil → Kasa (yönetici), Profil → Mesai (herkes).

---

## Kararlar
1. **Randevu onayı freemium olacak** — çekirdek işi trial sonrası bloklamak terk/1-yıldız riskiydi. Para katma-değerde toplanır. *(uygulandı)*
2. **Kasa tek ledger modeli** — ayrı income/expense yerine `cash_entries` + `type` alanı: tek kural, tek sorgu, net = gelir − gider. *(uygulandı)*
3. **Mesai owner-toggle değil, self clock-in/out** — personel kendi vardiyasını başlatır/bitirir. *(uygulandı)*

---

## Manuel kalan (sahibi yapacak) — pilot öncesi kritik
- [ ] **Deploy:** her iki repodan `firebase deploy --only firestore:rules,firestore:indexes,storage` — rules fix'leri deploy edilene kadar canlıda etkisiz (son deploy kazanır).
- [ ] **Anahtar rotasyonu:** `env.json`'daki Supabase/OpenAI/Gemini/Anthropic/Perplexity anahtarları geçmişte kaldı → panellerden yenile + `git filter-repo`/BFG ile geçmişten temizle.
- [ ] Branch'ler için PR aç / main'e merge.

---

## Sıradaki yol haritası (henüz yapılmadı)
- **Kapora / online ödeme** (no-show'un en büyük çözümü, Pro değeri) — roadmap P1.3.
- **S3 Review manipülasyonu:** salon kendi review'unu yazıp/silebiliyor → yalnızca müşteri + salon "yanıt".
- **S4:** randevu durum geçişi + Pro-gate'i callable Function'a taşı (şu an client-side).
- **U7:** onboarding'e hizmet/fiyat + çalışma saati + ilk-çalıştırma checklist; "General Service" dummy'sini kaldır.
- **B5:** iki-app field kontratını tam normalize et (`businessId` tek standart).
- Gider/analitik: Kasa giderlerini analytics'e bağla; nakit vs kart raporu.

Tam teknik review: her iki repoda kod + `salonpro_business/docs/plans/2026-04-26-appointment-reliability-roadmap.md`.
