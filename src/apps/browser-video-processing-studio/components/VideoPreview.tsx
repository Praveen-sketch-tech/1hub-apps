interface Props {
  src: string
}

export function VideoPreview({ src }: Props) {
  return <video className="bvps-video" src={src} controls playsInline />
}
