// 서울·경기 해바라기센터 지역 연결 (v0.5 후속 변경, 2026-11-07)
// 원본: src/data/v05/center_directory.json (센터 11곳 초안), center_region_mapping.json (시·군·구 → 센터 정적 연결표)
// - GPS·지도 API·직선거리 계산을 쓰지 않음. 사용자가 고른 시·군·구 키로 표를 찾기만 함.
// - 연결표는 '제안안'(PROPOSED_NOT_DISTANCE_VERIFIED)이라 화면에서 '가장 가까운 센터'라고 말하지 않음.
// - 센터 주소·전화·운영시간은 모두 게시 전 재검증 대상(REVERIFY_OFFICIAL_BEFORE_PUBLICATION).
//   운영자가 공식 출처로 확인해 content/centers/verified.json 에 올린 센터만 공개 빌드에 보이고,
//   나머지는 미리보기 빌드(npm run dev:preview)에서 '공식 확인 전' 표시와 함께만 보임.
import directory from './v05/center_directory.json';
import mapping from './v05/center_region_mapping.json';
import verifiedFile from '../../content/centers/verified.json';
import { SHOW_DRAFTS } from './content';

export interface Center {
  id: string; name: string; type: string; province: string; city: string; district: string | null;
  address: string | null; phone: string | null; phoneOngoing: string | null; homepage: string | null; notes: string;
  /** 운영자 확인 기록이 있으면 공개 */
  verified: { checkedAt: string; sourceUrl: string } | null;
}
export interface RegionRow {
  province: string; city: string; district: string | null; regionKey: string;
  primaryCenterId: string; additionalCenterIds: string[]; childCenterIds: string[];
  childAccessibleCitywide?: boolean; childAccessibleProvincewide?: boolean; mappingStatus: string;
}

type Verified = { id: string; checkedAt: string; sourceUrl: string; approvedBy: string };
const VERIFIED = new Map(((verifiedFile as { centers: Verified[] }).centers ?? []).map((v) => [v.id, v]));

export const CENTERS: Center[] = (directory as any).centers.map((c: any) => {
  const v = VERIFIED.get(c.id);
  return {
    id: c.id, name: c.name, type: c.type, province: c.province, city: c.city, district: c.district,
    address: c.address_provisional, phone: c.contact_primary_provisional, phoneOngoing: c.contact_ongoing_provisional,
    homepage: c.official_website_from_conversation, notes: c.notes,
    verified: v ? { checkedAt: v.checkedAt, sourceUrl: v.sourceUrl } : null,
  };
});

/** 화면에 보여도 되는 센터: 공개 빌드는 확인된 것만, 미리보기는 전부(표시 붙임) */
export const showable = (c: Center) => !!c.verified || SHOW_DRAFTS;

export const REGIONS: RegionRow[] = (mapping as any).regions;
export const MAPPING_STATUS: string = (mapping as any).mappingStatus;

/** 지역 고르기 목록: 서울 = 구, 경기 = 시·군 → (일반구가 있는 시는) 구 */
export const SEOUL = REGIONS.filter((r) => r.province === '서울특별시').map((r) => r.district!).sort((a, b) => a.localeCompare(b, 'ko'));
export const GYEONGGI: { city: string; districts: string[] }[] = [...new Set(REGIONS.filter((r) => r.province === '경기도').map((r) => r.city))]
  .sort((a, b) => a.localeCompare(b, 'ko'))
  .map((city) => ({ city, districts: REGIONS.filter((r) => r.province === '경기도' && r.city === city && r.district).map((r) => r.district!) }));

/** 브라우저로 보내는 작은 연결표 (서울·경기 72줄) — 키 → [기본, 추가, 아동] */
export const regionTable = () => Object.fromEntries(REGIONS.map((r) => {
  // 아동형: 행에 직접 연결된 곳. 없고 '시·도 전체 이용 가능' 표시가 있으면 같은 시·도의 아동형 센터
  const childWide = (r.childAccessibleCitywide || r.childAccessibleProvincewide)
    ? CENTERS.filter((c) => c.type === '아동형' && c.province === r.province).map((c) => c.id) : [];
  return [r.regionKey, { p: r.primaryCenterId, a: r.additionalCenterIds, c: r.childCenterIds.length ? r.childCenterIds : childWide, s: r.mappingStatus }];
}));
