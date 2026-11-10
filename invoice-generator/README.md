# Invoice Calculator — Dokumentasi Rumus & Logika Perhitungan

Dokumen ini menjelaskan seluruh rumus matematika, aturan pembulatan (*rounding*), konvensi hari **30/360**, aturan status produk (**Production**, **Suspend**, **Terminate**, **Delete**), serta alokasi tagihan per periode invoice yang diimplementasikan di [`src/utils/calculator.ts`](src/utils/calculator.ts).

---

## 1. Konvensi Tanggal & Perhitungan Durasi (30/360)

Seluruh perhitungan durasi bulan dan prorata menggunakan standar akuntansi **30/360** (1 bulan = 30 hari, 1 tahun = 360 hari).

### 1.1 Penyesuaian Tanggal Akhir Bulan (`adjustDayFor360Convention`)
Jika tanggal (`day`) jatuh pada tanggal **28, 29, atau 31**, maka tanggal tersebut disesuaikan menjadi **30**:

$$\text{adj}(d) = \begin{cases} 30 & \text{jika } d \in \{28, 29, 31\} \\ d & \text{selainnya} \end{cases}$$

### 1.2 Jumlah Hari 30/360 (`calculateDays360Between`)
Untuk tanggal mulai $(Y_1, M_1, D_1)$ dan tanggal selesai $(Y_2, M_2, D_2)$ (inklusif):

$$\text{Days}_{360} = (Y_2 - Y_1) \times 360 + (M_2 - M_1) \times 30 + \text{adj}(D_2) - \text{adj}(D_1) + 1$$

### 1.3 Durasi Kontrak Berlangganan (`calculateContractDurationInMonths`)
Basis prorata untuk semua frekuensi (*Monthly*, *Quarterly*, *Semester*, *Yearly*) adalah **30 hari** (karena harga produk *Recurring* diinput sebagai harga per bulan):

$$\text{Recurring Duration (bulan)} = \text{round}_2\left(\frac{\text{Days}_{360}(\text{StartDate}, \text{EndDate})}{30}\right)$$

---

## 2. Pembentukan Jadwal Periode Invoice (`generateBillingPeriods`)

Jumlah bulan per invoice ($\text{MPI}$) ditentukan oleh frekuensi billing:
- **Monthly**: $1$ bulan
- **Quarterly**: $3$ bulan
- **Semester**: $6$ bulan
- **Yearly**: $12$ bulan

Untuk setiap invoice ke-$k$ ($k = 1, 2, \dots, 25$):
1. **Tanggal Mulai Periode ($S_k$)**:
   - Untuk $k = 1$: $S_1 = \text{StartDate}$
   - Untuk $k > 1$: $S_k = E_{k-1} + 1 \text{ hari kalender}$
2. **Batas Cutoff Berikutnya ($\text{Cutoff}_k$)**:
   - Jika tidak memakai *Cycle Day* (atau frekuensi selain *Monthly*):
     $$\text{Cutoff}_k = \text{addMonths}(\text{StartDate}, \text{MPI} \times k)$$
   - Jika *Monthly* dengan *Cycle Day* ($C$):
     - Jika $S_k.\text{day} == C$: $\text{addMonths}(S_k, 1)$
     - Jika $S_k.\text{day} < C$: tanggal $C$ pada bulan yang sama dengan $S_k$
     - Jika $S_k.\text{day} > C$: tanggal $C$ pada bulan berikutnya ($S_k.\text{month} + 1$)
3. **Tanggal Akhir Periode ($E_k$)**:
   $$E_k = \min(\text{EndDate}, \text{Cutoff}_k - 1 \text{ hari kalender})$$
4. **Hari & Faktor Prorata Periode ($f_k$)**:
   $$\text{Days}_k = \text{Days}_{360}(S_k, E_k)$$
   $$f_k = \text{round}_9\left(\frac{\text{Days}_k}{30}\right)$$
   *(Contoh: 1 bulan penuh = $30/30 = 1$, 1 kuartal penuh = $90/30 = 3$, 15 hari = $15/30 = 0.5$).*

---

## 3. Aturan Pembulatan Berdasarkan Unit (`roundByUnitType`)

Setiap item memiliki pilihan `Unit`:
- **`Unit` (Non-GB)**: Dibulatkan ke bilangan bulat terdekat (`Math.round(x)` / $\text{round}_0$).
- **`GB`**: Mempertahankan **2 angka di belakang koma** (`Number(x.toFixed(2))` / $\text{round}_2$) untuk harga satuan, diskon dasar per unit, harga net per unit, dan total diskon dasar.

$$\text{roundUnit}(x) = \begin{cases} \text{round}_2(x) & \text{jika Unit} = \text{GB} \\ \text{round}_0(x) & \text{jika Unit} = \text{Unit} \end{cases}$$

> **Catatan Penting**: Nilai **Total After Basic Discount**, **Additional Discount**, **Item Grand Total**, **Taxes & Charges**, **Deducted Taxes**, dan **Invoice Grand Total** selalu dibulatkan ke bilangan bulat ($\text{round}_0$).

---

## 4. Aturan Status Item & Fitur Terminate All

Setiap item memiliki salah satu dari 4 status berikut:

| Status | Perhitungan SO Value | Perhitungan di Invoice | Perilaku Saat "Terminate All" |
| :--- | :--- | :--- | :--- |
| **Production** | Dihitung penuh sesuai durasi kontrak | Ditagihkan penuh sesuai jadwal periode | Berubah menjadi `Terminate` dengan tanggal *Terminate All* |
| **Suspend** | Dihitung penuh sesuai durasi kontrak | Tetap ditagihkan penuh seperti *Production* | Berubah menjadi `Terminate` dengan tanggal *Terminate All* |
| **Terminate** | **Tetap dihitung penuh** sesuai durasi kontrak awal | Ditagihkan **hanya sampai `Terminate Date`** item tersebut (prorata di periode terjadinya terminate, dan $0$ di invoice berikutnya) | **Tidak di-override** (tanggal terminate lama pada item tetap dipertahankan) |
| **Delete** | Diabaikan ($0$) | Diabaikan ($0$) | **Tidak di-override** (tetap `Delete`) |

---

## 5. Perhitungan Nilai Dasar Kontrak / Sales Order (SO) per Produk (`calculateSingleProductMetrics`)

Untuk setiap produk aktif (memiliki harga dan berstatus selain `Delete`):

1. **Durasi Kontrak Produk ($\text{Dur}_{\text{SO}}$)**:
   - **Recurring**: $\text{Dur}_{\text{SO}} = \text{Recurring Duration (bulan)}$
   - **One time**: $\text{Dur}_{\text{SO}} = 1$
   - **DR (Daily)**: $\text{Dur}_{\text{SO}} = \max(0, \text{Days}_{360}(\text{DR Start}, \text{DR End}))$
2. **Price per Unit ($P$)**:
   $$P = \text{roundUnit}(\text{Price Input})$$
3. **Basic Discount per Unit ($\text{BD}_{\text{unit}}$)**:
   $$\text{BD}_{\text{unit}} = \begin{cases} \text{roundUnit}\left(\frac{P \times \text{BasicDisc\%}}{100}\right) & \text{jika Percentage} \\ \text{roundUnit}(\text{BasicDiscAmt}) & \text{jika Amount} \end{cases}$$
4. **Net Price per Unit ($\text{Net}_{\text{unit}}$)**:
   $$\text{Net}_{\text{unit}} = \text{roundUnit}(P - \text{BD}_{\text{unit}})$$
5. **Total Basic Discount Kontrak ($\text{TBD}_{\text{SO}}$)**:
   $$\text{TBD}_{\text{SO}} = \text{roundUnit}(\text{BD}_{\text{unit}} \times \text{Qty} \times \text{Dur}_{\text{SO}})$$
6. **Total After Basic Discount ($\text{TT}_{\text{SO}}$)**:
   $$\text{TT}_{\text{SO}} = \text{round}_0((P - \text{BD}_{\text{unit}}) \times \text{Qty} \times \text{Dur}_{\text{SO}})$$
7. **Additional Discount ($\text{AD}_{\text{SO}}$)**:
   $$\text{AD}_{\text{SO}} = \begin{cases} \text{round}_0\left(\frac{\text{TT}_{\text{SO}} \times \text{AddlDisc\%}}{100}\right) & \text{jika Percentage} \\ \text{round}_0(\text{AddlDiscAmt}) & \text{jika Amount} \end{cases}$$
8. **Item Grand Total SO ($\text{GT}_{\text{SO}}$)**:
   $$\text{GT}_{\text{SO}} = \text{round}_0(\text{TT}_{\text{SO}} - \text{AD}_{\text{SO}})$$

---

## 6. Alokasi Nilai Produk ke Setiap Periode Invoice (`allocateProductToBillingPeriods`)

### 6.1 Produk Tipe `Recurring`
Untuk setiap periode invoice ke-$k$ dengan rentang $[S_k, E_k]$:
- Batas akhir efektif item ($E_{\text{eff}}$):
  - Jika status `Production` atau `Suspend`: $E_{\text{eff}} = \text{EndDate}$
  - Jika status `Terminate`: $E_{\text{eff}} = \min(\text{EndDate}, \text{TerminateDate})$
- **Jika $S_k > E_{\text{eff}}$** (periode invoice berada setelah tanggal Terminate):
  - Seluruh nilai pada periode ini adalah **$0$**.
- **Jika $S_k \le E_{\text{eff}}$** (produk aktif penuh atau sebagian di periode ini):
  - Tanggal akhir aktif di periode $k$: $E_{\text{active}, k} = \min(E_k, E_{\text{eff}})$
  - Hari aktif di periode $k$:
    $$\text{Days}_{\text{active}, k} = \text{Days}_{360}(S_k, E_{\text{active}, k})$$
  - Faktor prorata item di periode $k$:
    $$f_{\text{item}, k} = \text{round}_9\left(\frac{\text{Days}_{\text{active}, k}}{30}\right)$$
  - **Harga & Diskon Satuan di Periode $k$**:
    $$P_k = \text{roundUnit}(P \times f_{\text{item}, k})$$
    $$\text{BD}_{\text{unit}, k} = \begin{cases} \text{roundUnit}\left(\frac{P_k \times \text{BasicDisc\%}}{100}\right) & \text{jika Percentage} \\ \text{roundUnit}(\text{BD}_{\text{unit}} \times f_{\text{item}, k}) & \text{jika Amount} \end{cases}$$
    $$\text{Net}_{\text{unit}, k} = \text{roundUnit}(P_k - \text{BD}_{\text{unit}, k})$$
  - **Total Periode $k$ (Periode Berjalan / Terminated Sebelum Akhir Kontrak)**:
    $$\text{TBD}_k = \text{roundUnit}(\text{BD}_{\text{unit}, k} \times \text{Qty})$$
    $$\text{TT}_k = \text{round}_0(\text{Net}_{\text{unit}, k} \times \text{Qty})$$
    $$\text{AD}_k = \text{round}_0\left(\frac{\text{AD}_{\text{SO}} \times f_{\text{item}, k}}{\text{Dur}_{\text{SO}}}\right)$$
    $$\text{GT}_k = \text{round}_0(\text{TT}_k - \text{AD}_k)$$
  - **Penyerapan Selisih Pembulatan di Periode Terakhir Kontrak Penuh**:
    Jika periode ke-$k$ adalah periode terakhir kontrak ($E_k == \text{EndDate}$) **dan** item aktif sampai akhir kontrak penuh ($E_{\text{eff}} \ge \text{EndDate}$), maka periode terakhir menyerap sisa pembulatan agar total seluruh invoice sama persis dengan nilai SO ($\text{Difference} = 0$):
    $$\text{TBD}_{\text{last}} = \text{roundUnit}\left(\text{TBD}_{\text{SO}} - \sum_{i=1}^{k-1} \text{TBD}_i\right)$$
    $$\text{TT}_{\text{last}} = \text{TT}_{\text{SO}} - \sum_{i=1}^{k-1} \text{TT}_i$$
    $$\text{AD}_{\text{last}} = \text{AD}_{\text{SO}} - \sum_{i=1}^{k-1} \text{AD}_i$$
    $$\text{GT}_{\text{last}} = \text{GT}_{\text{SO}} - \sum_{i=1}^{k-1} \text{GT}_i$$
    *(Sebaliknya, jika item berstatus `Terminate` sebelum akhir kontrak $E_{\text{eff}} < \text{EndDate}$, periode terakhir aktif dihitung murni secara prorata sesuai hari aktifnya tanpa menyerap sisa masa kontrak yang dibatalkan, sehingga selisih antara SO dan total invoice terlihat jelas pada kolom **Difference**).*

### 6.2 Produk Tipe `One time`
- Ditagihkan penuh pada **INV 1** ($k = 0$), kecuali jika berstatus `Terminate` dengan `Terminate Date` sebelum `StartDate` (maka bernilai $0$).

### 6.3 Produk Tipe `DR (Daily)`
- Masuk ke satu invoice yang mencakup tanggal `DR Start` (`dailyRateStartDate`).
- Jika status `Production` atau `Suspend` (atau `Terminate` dengan `Terminate Date` $\ge$ `DR End`), ditagihkan penuh sebesar nilai DR.
- Jika status `Terminate` dan `Terminate Date` memotong di tengah rentang DR ($\text{DR Start} \le \text{Terminate Date} < \text{DR End}$), maka dihitung sesuai jumlah hari aktif dari `DR Start` sampai `Terminate Date`.

---

## 7. Agregasi Ringkasan Finansial, Pajak, & Rekonsiliasi (`calculateInvoiceFinancialSummaries`)

Baik untuk kolom **SO Value** maupun setiap kolom **INV $k$**, subtotal dihitung dengan menjumlahkan seluruh produk aktif:

1. **Subtotal per Tipe Produk**:
   $$\text{OneTime} = \text{round}_2\left(\sum_{\text{type}=\text{One time}} \text{GT}\right)$$
   $$\text{Recurring} = \text{round}_2\left(\sum_{\text{type}=\text{Recurring}} \text{GT}\right)$$
   $$\text{DR} = \text{round}_2\left(\sum_{\text{type}=\text{DR}} \text{GT}\right)$$

2. **Pre-Tax Total**:
   - Jika terdapat minimal satu produk aktif ber-unit `GB`, `PreTax` mempertahankan 2 desimal ($\text{round}_2$); jika seluruh produk adalah `Unit` non-GB, `PreTax` dibulatkan ke bilangan bulat ($\text{round}_0$):
   $$\text{PreTax}_{\text{raw}} = \text{OneTime} + \text{Recurring} + \text{DR}$$
   $$\text{PreTax} = \text{roundSummary}(\text{PreTax}_{\text{raw}})$$

3. **Taxes & Charges ($\text{Tax}$)** dan **Deducted Taxes ($\text{Ded}$)**:
   Dihitung dan dibulatkan ke bilangan bulat ($\text{round}_0$) secara independen pada SO dan pada masing-masing invoice:
   $$\text{Tax}_{\text{raw}} = \text{PreTax} \times \frac{\text{Tax\%}}{100}, \quad \text{Tax} = \text{round}_0(\text{Tax}_{\text{raw}})$$
   $$\text{Ded}_{\text{raw}} = \text{PreTax} \times \frac{\text{Ded\%}}{100}, \quad \text{Ded} = \text{round}_0(\text{Ded}_{\text{raw}})$$

4. **Grand Total**:
   $$\text{Grand}_{\text{raw}} = \text{PreTax}_{\text{raw}} + \text{Tax}_{\text{raw}} - \text{Ded}_{\text{raw}}$$
   $$\text{Grand} = \text{round}_0(\text{PreTax} + \text{Tax} - \text{Ded})$$

5. **Kolom Invoice Total & Difference**:
   $$\text{Invoice Total} = \sum_{k=1}^{N} \text{Nilai}_{\text{INV } k}$$
   $$\text{Difference} = \text{Invoice Total} - \text{SO Value}$$

6. **Konversi Kurs Mata Uang Asing (`Exchange Rate`)**:
   Jika `Exchange Rate` ($\text{XR}$) diisi selain $1$, seluruh nilai mata uang pada tabel ringkasan dan breakdown produk dikalikan dengan $\text{XR}$ pada saat ditampilkan.
