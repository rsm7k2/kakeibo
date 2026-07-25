import { useEffect, useState } from 'react'

type Operator = '+' | '-' | '×' | '÷'

interface Props {
  /** 編集モード等で、初期表示したい金額(新規入力時は指定しない) */
  initialValue?: number
  /** 計算結果(現時点で確定している金額)が変わるたびに呼ばれる */
  onChange: (amount: number) => void
}

function calc(a: number, op: Operator, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b !== 0 ? a / b : a
  }
}

export default function CalculatorInput({ initialValue, onChange }: Props) {
  const [display, setDisplay] = useState(
    initialValue && initialValue > 0 ? String(initialValue) : '0'
  )
  const [accumulator, setAccumulator] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [justPressedOperator, setJustPressedOperator] = useState(false)

  // 現時点で確定している金額(演算子が未確定でも、押した時点の計算結果を返す)
  const finalAmount = (() => {
    const current = parseFloat(display || '0')
    if (operator !== null) {
      return calc(accumulator ?? 0, operator, current)
    }
    return current
  })()

  useEffect(() => {
    onChange(isNaN(finalAmount) ? 0 : finalAmount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, accumulator, operator])

  const pressDigit = (d: string) => {
    if (justPressedOperator) {
      setDisplay(d === '.' ? '0.' : d)
      setJustPressedOperator(false)
      return
    }
    if (d === '.' && display.includes('.')) return
    setDisplay(display === '0' && d !== '.' ? d : display + d)
  }

  const pressOperator = (op: Operator) => {
    const current = parseFloat(display || '0')
    if (accumulator !== null && operator !== null && !justPressedOperator) {
      const result = calc(accumulator, operator, current)
      setAccumulator(result)
      setDisplay(String(result))
    } else {
      setAccumulator(current)
    }
    setOperator(op)
    setJustPressedOperator(true)
  }

  const pressEquals = () => {
    if (operator === null) return
    const current = parseFloat(display || '0')
    const result = calc(accumulator ?? 0, operator, current)
    setDisplay(String(result))
    setAccumulator(null)
    setOperator(null)
    setJustPressedOperator(true)
  }

  const pressClear = () => {
    setDisplay('0')
    setAccumulator(null)
    setOperator(null)
    setJustPressedOperator(false)
  }

  const pressBackspace = () => {
    if (justPressedOperator) return
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0')
  }

  const numClass = 'py-3 rounded-lg text-lg font-bold bg-gray-100 active:bg-gray-200'
  const opClass = 'py-3 rounded-lg text-lg font-bold bg-orange-100 text-orange-600 active:bg-orange-200'

  return (
    <div>
      {/* ディスプレイ */}
      <div className="border rounded-lg p-3 mb-2 text-right">
        <div className="text-xs text-gray-400 h-4">
          {accumulator !== null && operator
            ? `${accumulator.toLocaleString('ja-JP')} ${operator}`
            : '\u00A0'}
        </div>
        <div className="text-3xl font-bold">
          ¥{(isNaN(Number(display)) ? 0 : Number(display)).toLocaleString('ja-JP', {
            maximumFractionDigits: 10
          })}
        </div>
      </div>

      {/* キーパッド */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={pressClear} className={`${numClass} text-red-500`} type="button">
          C
        </button>
        <button onClick={pressBackspace} className={numClass} type="button">
          ⌫
        </button>
        <button onClick={() => pressOperator('÷')} className={opClass} type="button">
          ÷
        </button>
        <button onClick={() => pressOperator('×')} className={opClass} type="button">
          ×
        </button>

        <button onClick={() => pressDigit('7')} className={numClass} type="button">
          7
        </button>
        <button onClick={() => pressDigit('8')} className={numClass} type="button">
          8
        </button>
        <button onClick={() => pressDigit('9')} className={numClass} type="button">
          9
        </button>
        <button onClick={() => pressOperator('-')} className={opClass} type="button">
          －
        </button>

        <button onClick={() => pressDigit('4')} className={numClass} type="button">
          4
        </button>
        <button onClick={() => pressDigit('5')} className={numClass} type="button">
          5
        </button>
        <button onClick={() => pressDigit('6')} className={numClass} type="button">
          6
        </button>
        <button onClick={() => pressOperator('+')} className={opClass} type="button">
          ＋
        </button>

        <button onClick={() => pressDigit('1')} className={numClass} type="button">
          1
        </button>
        <button onClick={() => pressDigit('2')} className={numClass} type="button">
          2
        </button>
        <button onClick={() => pressDigit('3')} className={numClass} type="button">
          3
        </button>
        <button
          onClick={pressEquals}
          className="py-3 rounded-lg text-lg font-bold bg-green-500 text-white active:bg-green-600"
          type="button"
        >
          ＝
        </button>

        <button onClick={() => pressDigit('0')} className={`${numClass} col-span-3`} type="button">
          0
        </button>
        <button onClick={() => pressDigit('.')} className={numClass} type="button">
          .
        </button>
      </div>
    </div>
  )
}
