import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

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
  const pointerIdRef = useRef<number | null>(null)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    baseXRef.current = translateX
    directionRef.current = null
    pointerIdRef.current = e.pointerId
    // この時点ではまだポインタをキャプチャしない(縦スクロールの可能性があるため)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === null) return
    const deltaX = e.clientX - startXRef.current
    const deltaY = e.clientY - startYRef.current

    if (directionRef.current === null) {
      // 一定量動くまでは、横スワイプか縦スクロールか判定しない
      if (Math.abs(deltaX) < DIRECTION_LOCK_THRESHOLD && Math.abs(deltaY) < DIRECTION_LOCK_THRESHOLD) {
        return
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 横方向優位 → スワイプ削除の操作として扱う
        directionRef.current = 'horizontal'
        setDragging(true)
        try {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          // no-op
        }
      } else {
        // 縦方向優位 → スクロール操作とみなし、以降は何もしない(ブラウザ標準のスクロールに委ねる)
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
    const direction = directionRef.current
    pointerIdRef.current = null
    directionRef.current = null
    setDragging(false)

    if (direction === 'vertical') {
      // スクロール操作だったので、タップ扱いにもスワイプ扱いにもしない
      return
    }

    if (direction === null) {
      // ほとんど動いていない = タップ
      if (translateX === 0) {
        onClick()
      } else {
        // 開いた状態でのタップは閉じるだけにする
        setTranslateX(0)
      }
      return
    }

    // 横スワイプ操作だった場合、移動量に応じて全開 or 全閉にスナップする
    setTranslateX(translateX < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0)
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
