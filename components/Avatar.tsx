import type { User } from '@/lib/store'

export default function Avatar({ user, size }: { user: User; size: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt={`${user.nickname} 프로필 이미지`} />
      ) : (
        user.nickname.charAt(0) || '?'
      )}
    </span>
  )
}
