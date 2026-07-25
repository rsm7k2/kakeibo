import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

const REVEAL_WIDTH = 80 // 削除ボタンの表示幅(px)
const DIRECTION_LOCK_THRESHOLD = 6 // この移動量を超えるまでは方向を確定しない(px)

type Direction = 'horizontal' | 'vertical' | null

interface Props {
  children: ReactNode
  onClick: () => void
  onDelete: () => void
}

export default function SwipeableRow({ children, onClick, onDelete }: Props) {
  const [translateX, setTranslateX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const baseXRef = useRef(0)
  const directionRef = useRef<Direction>(null)

  // 指の移動量計測は「横スワイプで削除ボタンを表示するアニメーション」専用。
  // タップ(編集画面への遷移)の判定はここでは行わず、ネイティブのclickイベントに任せる。
  // ブラウザは、タッチ後にスクロールが発生した場合は合成clickを発火しないため、
  // 縦スクロール中に誤って編集画面へ遷移することがなくなる。

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    baseXRef.current = translateX
    directionRef.current = null
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const deltaX = e.clientX - startXRef.current
    const deltaY = e.clientY - startYRef.current

    if (directionRef.current === null) {
      if (Math.abs(deltaX) < DIRECTION_LOCK_THRESHOLD && Math.abs(deltaY) < DIRECTION_LOCK_THRESHOLD) {
        return
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        directionRef.current = 'horizontal'
        setDragging(true)
        try {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          // no-op
        }
      } else {
        directionRef.current = 'vertical'
        return
      }
    }

    if (directionRef.current === 'horizontal') {
      const next = Math.min(0, Math.max(-REVEAL_WIDTH, baseXRef.current + deltaX))
      setTranslateX(next)
    }
  }

  const handlePointerUp = () => {
    const wasHorizontalDrag = directionRef.current === 'horizontal'
    directionRef.current = null
    setDragging(false)
    if (wasHorizontalDrag) {
      // 横スワイプの移動量に応じて全開 or 全閉にスナップする
      setTranslateX((current) => (current < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
    }
  }

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (translateX !== 0) {
      // 削除ボタンが開いた状態でのタップは閉じるだけにする
      e.preventDefault()
      setTranslateX(0)
      return
    }
    onClick()
  }

  return (
    <div className="relative overflow-hidden">
      {/* 背後の削除ボタン */}
      <button
        onClick={onDelete}
        className="absolute inset-y-0 right-0 w-20 bg-red-500 text-white text-sm font-bold flex items-center justify-center"
      >
        削除
      </button>

      {/* 前面のコンテンツ(横スワイプで左右に動く。縦方向は素通しでスクロールさせる) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y'
        }}
        className="bg-white relative"
      >
        {children}
      </div>
    </div>
  )
}
