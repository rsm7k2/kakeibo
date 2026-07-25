interface Props {
  text: string
}

export default function LoadingOverlay({ text }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="bg-white rounded-2xl px-7 py-5 flex flex-col items-center gap-2.5">
        <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        <span className="text-sm text-gray-800">{text}</span>
      </div>
    </div>
  )
}
