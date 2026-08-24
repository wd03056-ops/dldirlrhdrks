import type { Room } from '../types/room'

/** 시드 방은 재현 가능한 고정 해시 ID 사용 */
const SEED_SLUGS: Record<number, string> = {
  1: 'a7f3c91e2b4d8e6f0a1c3d5e7b9f2a4c',
  2: 'b8e4d02f3c5a9f7e1b2d4e6f8a0c3b5d',
  3: 'c9f5e13a4d6b0a8f2c3e5f7a9b1d4c6e',
}

function seedRoom(room: Omit<Room, 'slug'>): Room {
  return {
    ...room,
    slug: SEED_SLUGS[room.id] ?? `seed${room.id.toString(16).padStart(30, '0')}`,
  }
}

export const INITIAL_ROOMS: Room[] = [
  seedRoom({
    id: 1,
    title: '대학동창',
    members: 4,
    memberList: [
      { id: 1, name: '김민수' },
      { id: 2, name: '이서연' },
      { id: 3, name: '박지훈' },
      { id: 4, name: '최유진' },
    ],
    lastPhoto: null,
    coverPhoto: null,
    memories: [
      {
        id: 11,
        title: '졸업여행',
        lastPhoto:
          'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&auto=format&fit=crop',
        children: [],
      },
      {
        id: 12,
        title: 'MT',
        lastPhoto:
          'https://images.unsplash.com/photo-1517457373958-b7bdd7d834ea?w=400&auto=format&fit=crop',
        children: [],
      },
    ],
  }),
  seedRoom({
    id: 2,
    title: '고등동창',
    members: 3,
    memberList: [
      { id: 1, name: '정하늘' },
      { id: 2, name: '오세린' },
      { id: 3, name: '한도윤' },
    ],
    lastPhoto: null,
    coverPhoto: null,
    memories: [
      {
        id: 20,
        title: '여행',
        lastPhoto:
          'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&auto=format&fit=crop',
        children: [
          {
            id: 21,
            title: '제주여행',
            date: '2026-03-14',
            lastPhoto:
              'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&auto=format&fit=crop',
            photos: [
              'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1617597230007-10b46281209a?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1501785888041-af3ef285d470?w=800&auto=format&fit=crop',
            ],
            content:
              '3월 제주 여행, 바람은 차가웠지만 우리는 늘 웃었어요.\n\n성산일출봉에서 본 일출, 흑돼지 저녁, 그리고 새벽까지 이어진 수다.\n\n다음엔 꼭 다시 가자!',
            author: '정하늘',
          },
          {
            id: 22,
            title: '목포여행',
            date: '2026-07-02',
            lastPhoto:
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop',
            photos: [
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1476514525535-07fb3b4fcc5f?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1439066615861-d1af74d74005?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop',
            ],
            content:
              '목포 여름 바다. 유달산에서 본 노을, 갓 잡은 회 한 접시, 항구 앞 카페에서의 오후였어요.',
            author: '오세린',
          },
          {
            id: 23,
            title: '서울여행',
            date: '2026-11-22',
            lastPhoto:
              'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&auto=format&fit=crop',
            photos: [
              'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1538485399082-10f8a566f4da?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&auto=format&fit=crop',
            ],
            content:
              '서울 겨울 나들이. 북촌 한옥마을 산책, 광장시장 먹거리, 한강 야경까지—추워도 손을 잡고 걸었던 하루.',
          },
        ],
      },
      {
        id: 30,
        title: '결혼식',
        lastPhoto:
          'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&auto=format&fit=crop',
        children: [],
      },
      {
        id: 40,
        title: '생일',
        lastPhoto:
          'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&auto=format&fit=crop',
        children: [],
      },
    ],
  }),
  seedRoom({
    id: 3,
    title: '가족',
    members: 5,
    memberList: [
      { id: 1, name: '아빠' },
      { id: 2, name: '엄마' },
      { id: 3, name: '형' },
      { id: 4, name: '나' },
      { id: 5, name: '동생' },
    ],
    lastPhoto: null,
    coverPhoto: null,
    memories: [
      {
        id: 51,
        title: '가족여행',
        lastPhoto:
          'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&auto=format&fit=crop',
        children: [],
      },
      {
        id: 52,
        title: '명절',
        lastPhoto:
          'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop',
        children: [],
      },
    ],
  }),
]

export function getBootstrapRooms() {
  const stored = localStorage.getItem('woori-rooms-v1')
  if (stored) return null
  return INITIAL_ROOMS
}
