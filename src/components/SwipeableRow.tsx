import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

const REVEAL_WIDTH = 80 // 削除ボタンの表示幅(px)
const TAP_THRESHOLD = 8 // これ未満の移動量ならタップとみなす(px)

interface Props {
  children: ReactNode
  onClick: () => void
  onDelete: () => void
}

export default function SwipeableRow({ children, onClick, onDelete }: Props) {
  const [translateX, setTranslateX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const baseXRef = useRef(0)
  const movedRef = useRef(0)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    baseXRef.current = translateX
    movedRef.current = 0
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const delta = e.clientX - startXRef.current
    movedRef.current = Math.abs(delta)
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, baseXRef.current + delta))
    setTranslateX(next)
  }

  const handlePointerUp = () => {
    setDragging(false)
    if (movedRef.current < TAP_THRESHOLD) {
      // タップとみなす
      if (translateX === 0) {
        onClick()
      } else {
        // 開いた状態でのタップは閉じるだけにする
        setTranslateX(0)
      }
      return
    }
    // スワイプ量に応じて全開 or 全閉にスナップする
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

      {/* 前面のコンテンツ(スワイプで左右に動く) */}
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
