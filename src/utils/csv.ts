// CSVインポート/エクスポート用の最小限のユーティリティ。
// メモ欄にカンマ・改行・引用符が含まれる可能性があるため、RFC4180相当の
// クォート処理(""でエスケープ)に対応した自前パーサ/生成を用意する。

/** CSVテキストを行×列の文字列配列にパースする(引用符・カンマ・改行に対応) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // 改行コードの違い(\r\n / \n)を吸収するため、\rは基本的に読み飛ばす
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // 次が\nならそちらで改行処理するのでここでは無視
    } else {
      field += ch
    }
  }

  // 末尾に改行がない最後の行を回収
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // 完全に空行(末尾の空行など)は除外
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function toCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** 行×列の文字列配列をCSVテキストに変換する(Excel互換のCRLF区切り) */
export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map(toCsvField).join(',')).join('\r\n')
}

/**
 * アップロードされたCSVファイルをデコードする。
 * まずUTF-8として厳密にデコードを試み(不正なバイト列があれば例外)、
 * 失敗した場合は日本語Windows Excelの既定であるShift_JISとして再デコードする。
 */
export async function decodeCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

/** CSVエクスポート結果をブラウザでファイルとしてダウンロードさせる */
export function downloadCsv(filename: string, csvText: string): void {
  // ExcelでBOM無しUTF-8を開くと文字化けするため、BOMを付与する
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
