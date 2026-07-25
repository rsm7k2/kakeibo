import { useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { parseCsv, stringifyCsv, decodeCsvFile, downloadCsv } from '../utils/csv'
import { todayJst } from '../utils/date'
import LoadingOverlay from '../components/LoadingOverlay'
import type { TransactionType, TransactionWithDetails } from '../types'

const CSV_HEADER = ['日付', 'カテゴリー', '範囲', '金額', 'メモ', '収支', '固定費']

interface ParsedRow {
  lineNumber: number // 元CSV上の行番号(ヘッダーを1行目として表示用)
  date: string
  categoryName: string
  scopeName: string
  memo: string
  typeText: string
  fixedCostText: string
  error: string | null
  type: TransactionType | null
  amount: number | null // 絶対値
  scopeId: number | null
  categoryId: number | null // 既存カテゴリに一致した場合のみ
  isNewCategory: boolean
  isDuplicate: boolean
  include: boolean
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

export default function CsvImportExport() {
  const { categories, scopes, reloadCategories, bumpTransactionsVersion } = useAppData()

  // --- エクスポート ---
  const [exportAllPeriod, setExportAllPeriod] = useState(true)
  const [exportStart, setExportStart] = useState(todayJst())
  const [exportEnd, setExportEnd] = useState(todayJst())
  const [exportScopeId, setExportScopeId] = useState<number | 'all'>('all')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // --- インポート ---
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [committing, setCommitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const start = exportAllPeriod ? '1900-01-01' : exportStart
      const end = exportAllPeriod ? '9999-12-31' : exportEnd
      const scopeQuery = exportScopeId === 'all' ? '' : `&scope_id=${exportScopeId}`
      const data = await api.get<TransactionWithDetails[]>(
        `/transactions?start=${start}&end=${end}${scopeQuery}`
      )
      const body = data.map((t) => [
        t.transaction_date,
        t.category_name,
        t.scope_name,
        String(t.type === 'expense' ? -t.amount : t.amount),
        t.memo ?? '',
        t.type === 'expense' ? '支出' : '収入',
        t.is_fixed_cost ? 'TRUE' : 'FALSE'
      ])
      const csvText = stringifyCsv([CSV_HEADER, ...body])
      downloadCsv(`kakeibo_${start}_${end}.csv`, csvText)
    } catch {
      setExportError('エクスポートに失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setExporting(false)
    }
  }

  const resetImport = () => {
    setRows(null)
    setParseError(null)
    setResultMessage(null)
  }

  const handleFileSelected = async (file: File) => {
    setParsing(true)
    setParseError(null)
    setResultMessage(null)
    setRows(null)
    try {
      const text = await decodeCsvFile(file)
      const table = parseCsv(text)
      if (table.length <= 1) {
        setParseError('データ行がありません(ヘッダーのみ、または空のファイルです)')
        return
      }

      const dataRows = table.slice(1)
      const parsed: ParsedRow[] = dataRows.map((cols, i) => {
        const [date, categoryName, scopeName, amountRaw, memo, typeText, fixedCostText] = [
          (cols[0] ?? '').trim(),
          (cols[1] ?? '').trim(),
          (cols[2] ?? '').trim(),
          (cols[3] ?? '').trim(),
          (cols[4] ?? '').trim(),
          (cols[5] ?? '').trim(),
          (cols[6] ?? '').trim()
        ]
        const lineNumber = i + 2 // ヘッダーが1行目

        const normalizedDate = date.replace(/\//g, '-')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          return {
            lineNumber, date, categoryName, scopeName, memo, typeText, fixedCostText,
            error: '日付の形式が不正です(YYYY-MM-DD)',
            type: null, amount: null, scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }

        let type: TransactionType | null = null
        if (typeText === '支出') type = 'expense'
        else if (typeText === '収入') type = 'income'
        if (!type) {
          return {
            lineNumber, date: normalizedDate, categoryName, scopeName, memo, typeText, fixedCostText,
            error: '収支は「支出」または「収入」を指定してください',
            type: null, amount: null, scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }

        const signedAmount = Number(amountRaw.replace(/,/g, ''))
        if (Number.isNaN(signedAmount) || signedAmount === 0) {
          return {
            lineNumber, date: normalizedDate, categoryName, scopeName, memo, typeText, fixedCostText,
            error: '金額が数値として読み取れません',
            type, amount: null, scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }
        if (type === 'expense' && signedAmount > 0) {
          return {
            lineNumber, date: normalizedDate, categoryName, scopeName, memo, typeText, fixedCostText,
            error: '収支が「支出」なのに金額がプラスになっています',
            type, amount: null, scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }
        if (type === 'income' && signedAmount < 0) {
          return {
            lineNumber, date: normalizedDate, categoryName, scopeName, memo, typeText, fixedCostText,
            error: '収支が「収入」なのに金額がマイナスになっています',
            type, amount: null, scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }

        const scope = scopes.find((s) => s.name === scopeName)
        if (!scope) {
          return {
            lineNumber, date: normalizedDate, categoryName, scopeName, memo, typeText, fixedCostText,
            error: `範囲「${scopeName}」が見つかりません`,
            type, amount: Math.abs(signedAmount), scopeId: null, categoryId: null,
            isNewCategory: false, isDuplicate: false, include: false
          }
        }

        const category = categories.find((c) => c.name === categoryName && c.type === type)

        return {
          lineNumber,
          date: normalizedDate,
          categoryName,
          scopeName,
          memo,
          typeText,
          fixedCostText,
          error: null,
          type,
          amount: Math.abs(signedAmount),
          scopeId: scope.id,
          categoryId: category ? category.id : null,
          isNewCategory: !category,
          isDuplicate: false,
          include: true
        }
      })

      // 重複判定: パース済みの日付範囲にある既存データと完全一致(日付・カテゴリ・範囲・金額・メモ)する行を検出
      const validDates = parsed.filter((r) => !r.error).map((r) => r.date)
      if (validDates.length > 0) {
        const minDate = validDates.reduce((a, b) => (a < b ? a : b))
        const maxDate = validDates.reduce((a, b) => (a > b ? a : b))
        const existing = await api.get<TransactionWithDetails[]>(
          `/transactions?start=${minDate}&end=${maxDate}`
        )
        for (const row of parsed) {
          if (row.error || row.isNewCategory) continue
          const dup = existing.some(
            (t) =>
              t.transaction_date === row.date &&
              t.category_id === row.categoryId &&
              t.scope_id === row.scopeId &&
              t.amount === row.amount &&
              (t.memo ?? '') === row.memo
          )
          if (dup) {
            row.isDuplicate = true
            row.include = false
          }
        }
      }

      setRows(parsed)
    } catch {
      setParseError('ファイルの読み込みに失敗しました')
    } finally {
      setParsing(false)
    }
  }

  const toggleRowInclude = (index: number) => {
    setRows((prev) =>
      prev
        ? prev.map((r, i) => (i === index ? { ...r, include: !r.include } : r))
        : prev
    )
  }

  const errorRows = rows?.filter((r) => r.error) ?? []
  const validRows = rows?.filter((r) => !r.error) ?? []
  const newCategoryNames = Array.from(
    new Set(validRows.filter((r) => r.isNewCategory).map((r) => `${r.type}:${r.categoryName}`))
  )
  const includedCount = validRows.filter((r) => r.include).length

  const handleCommitImport = async () => {
    if (!rows) return
    setCommitting(true)
    setParseError(null)
    try {
      // 未知カテゴリを先に作成し、name:type -> id のマップを作る
      const newCategoryIdMap = new Map<string, number>()
      for (const key of newCategoryNames) {
        const [type, name] = key.split(':') as [TransactionType, string]
        const res = await api.post<{ id: number }>('/categories', {
          name,
          type,
          icon: null,
          color: '#888888'
        })
        newCategoryIdMap.set(key, res.id)
      }
      if (newCategoryNames.length > 0) {
        await reloadCategories()
      }

      const toImport = validRows.filter((r) => r.include)
      const bulkRows = toImport.map((r) => ({
        type: r.type as TransactionType,
        amount: r.amount as number,
        category_id: r.categoryId ?? newCategoryIdMap.get(`${r.type}:${r.categoryName}`)!,
        scope_id: r.scopeId as number,
        transaction_date: r.date,
        memo: r.memo || null,
        is_fixed_cost: /^(true|1)$/i.test(r.fixedCostText)
      }))

      if (bulkRows.length > 0) {
        await api.post('/transactions/bulk', { rows: bulkRows })
        bumpTransactionsVersion()
      }

      setResultMessage(
        `${bulkRows.length}件を取り込みました${
          newCategoryNames.length > 0 ? `(新規カテゴリ ${newCategoryNames.length}件を作成)` : ''
        }。`
      )
      setRows(null)
    } catch {
      setParseError('取込みに失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* エクスポート */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 mb-2">エクスポート</h2>
        <div className="bg-white border rounded-2xl p-3 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setExportScopeId('all')}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                exportScopeId === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'
              }`}
            >
              全て
            </button>
            {scopes.map((s) => (
              <button
                key={s.id}
                onClick={() => setExportScopeId(s.id)}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  exportScopeId === s.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={exportAllPeriod}
              onChange={(e) => setExportAllPeriod(e.target.checked)}
              className="w-4 h-4"
            />
            全期間を対象にする
          </label>

          {!exportAllPeriod && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={exportStart}
                onChange={(e) => setExportStart(e.target.value)}
                className="border rounded-lg px-2 py-1.5 flex-1"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={exportEnd}
                onChange={(e) => setExportEnd(e.target.value)}
                className="border rounded-lg px-2 py-1.5 flex-1"
              />
            </div>
          )}

          {exportError && <p className="text-red-500 text-sm">{exportError}</p>}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-green-600 text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
          >
            {exporting ? '出力中...' : 'CSVをダウンロード'}
          </button>
        </div>
      </div>

      {/* インポート */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 mb-2">インポート</h2>
        <div className="bg-white border rounded-2xl p-3 space-y-3">
          <p className="text-xs text-gray-400">
            ヘッダー: 日付, カテゴリー, 範囲, 金額, メモ, 収支, 固定費(支出はマイナス、収入はプラス)
          </p>

          {!rows && (
            <label className="w-full flex items-center justify-center py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer">
              CSVファイルを選択
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelected(file)
                  e.target.value = ''
                }}
              />
            </label>
          )}

          {parseError && <p className="text-red-500 text-sm">{parseError}</p>}
          {resultMessage && <p className="text-green-600 text-sm">{resultMessage}</p>}

          {rows && (
            <div className="space-y-3">
              {newCategoryNames.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs text-blue-700">
                  新規作成されるカテゴリ: {newCategoryNames.map((k) => k.split(':')[1]).join('、')}
                </div>
              )}

              {errorRows.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-2 space-y-1">
                  <p className="text-xs font-bold text-red-600">
                    エラー行({errorRows.length}件、取込み対象外)
                  </p>
                  {errorRows.map((r) => (
                    <p key={r.lineNumber} className="text-xs text-red-500">
                      {r.lineNumber}行目: {r.error}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                {includedCount} / {validRows.length} 件を取込み対象として選択中(既存データと完全一致する行はデフォルトで除外しています)
              </p>

              <div className="border rounded-2xl divide-y overflow-hidden max-h-80 overflow-y-auto">
                {validRows.map((r) => {
                  const index = rows.indexOf(r)
                  return (
                    <label
                      key={r.lineNumber}
                      className="flex items-center gap-2 p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={() => toggleRowInclude(index)}
                        className="w-4 h-4 shrink-0"
                      />
                      <span className="text-gray-400 shrink-0">{r.date}</span>
                      <span className="flex-1 truncate">
                        {r.categoryName}
                        {r.isNewCategory && <span className="text-blue-500">(新規)</span>}
                        <span className="text-gray-400"> / {r.scopeName}</span>
                        {r.memo && <span className="text-gray-400"> ({r.memo})</span>}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          r.type === 'expense' ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {r.type === 'expense' ? '-' : '+'}¥{yen(r.amount ?? 0)}
                      </span>
                      {r.isDuplicate && (
                        <span className="text-orange-500 shrink-0">⚠️重複</span>
                      )}
                    </label>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCommitImport}
                  disabled={committing || includedCount === 0}
                  className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
                >
                  {committing ? '取込み中...' : `この内容で取り込む(${includedCount}件)`}
                </button>
                <button onClick={resetImport} className="px-4 text-sm text-gray-500">
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(parsing || committing) && <LoadingOverlay text={parsing ? '読み込み中' : '取込み中'} />}
    </div>
  )
}
