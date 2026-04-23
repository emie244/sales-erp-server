// 中国省级行政区列表
const PROVINCES = [
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区',
];

// 主要城市列表（简化版）
const CITY_MAP: Record<string, string[]> = {
  广东省: [
    '广州市',
    '深圳市',
    '珠海市',
    '汕头市',
    '佛山市',
    '韶关市',
    '湛江市',
    '肇庆市',
    '江门市',
    '茂名市',
    '惠州市',
    '梅州市',
    '汕尾市',
    '河源市',
    '阳江市',
    '清远市',
    '东莞市',
    '中山市',
    '潮州市',
    '揭阳市',
    '云浮市',
  ],
  北京市: ['北京市'],
  上海市: ['上海市'],
  天津市: ['天津市'],
  重庆市: ['重庆市'],
  江苏省: [
    '南京市',
    '无锡市',
    '徐州市',
    '常州市',
    '苏州市',
    '南通市',
    '连云港市',
    '淮安市',
    '盐城市',
    '扬州市',
    '镇江市',
    '泰州市',
    '宿迁市',
  ],
  浙江省: [
    '杭州市',
    '宁波市',
    '温州市',
    '嘉兴市',
    '湖州市',
    '绍兴市',
    '金华市',
    '衢州市',
    '舟山市',
    '台州市',
    '丽水市',
  ],
  福建省: [
    '福州市',
    '厦门市',
    '莆田市',
    '三明市',
    '泉州市',
    '漳州市',
    '南平市',
    '龙岩市',
    '宁德市',
  ],
  山东省: [
    '济南市',
    '青岛市',
    '淄博市',
    '枣庄市',
    '东营市',
    '烟台市',
    '潍坊市',
    '济宁市',
    '泰安市',
    '威海市',
    '日照市',
    '莱芜市',
    '临沂市',
    '德州市',
    '聊城市',
    '滨州市',
    '菏泽市',
  ],
  河南省: [
    '郑州市',
    '开封市',
    '洛阳市',
    '平顶山市',
    '安阳市',
    '鹤壁市',
    '新乡市',
    '焦作市',
    '濮阳市',
    '许昌市',
    '漯河市',
    '三门峡市',
    '南阳市',
    '商丘市',
    '信阳市',
    '周口市',
    '驻马店市',
  ],
  湖北省: [
    '武汉市',
    '黄石市',
    '十堰市',
    '宜昌市',
    '襄阳市',
    '鄂州市',
    '荆门市',
    '孝感市',
    '荆州市',
    '黄冈市',
    '咸宁市',
    '随州市',
    '恩施土家族苗族自治州',
  ],
  湖南省: [
    '长沙市',
    '株洲市',
    '湘潭市',
    '衡阳市',
    '邵阳市',
    '岳阳市',
    '常德市',
    '张家界市',
    '益阳市',
    '郴州市',
    '永州市',
    '怀化市',
    '娄底市',
    '湘西土家族苗族自治州',
  ],
  四川省: [
    '成都市',
    '自贡市',
    '攀枝花市',
    '泸州市',
    '德阳市',
    '绵阳市',
    '广元市',
    '遂宁市',
    '内江市',
    '乐山市',
    '南充市',
    '眉山市',
    '宜宾市',
    '广安市',
    '达州市',
    '雅安市',
    '巴中市',
    '资阳市',
    '阿坝藏族羌族自治州',
    '甘孜藏族自治州',
    '凉山彝族自治州',
  ],
  河北省: [
    '石家庄市',
    '唐山市',
    '秦皇岛市',
    '邯郸市',
    '邢台市',
    '保定市',
    '张家口市',
    '承德市',
    '沧州市',
    '廊坊市',
    '衡水市',
  ],
};

export interface ParsedAddress {
  province: string;
  city: string;
  district: string;
  detail: string;
}

export function parseAddress(address: string): ParsedAddress | null {
  if (!address || address.trim().length < 3) {
    return null;
  }

  const trimmedAddress = address.trim();

  // 1. 识别省份
  let province = '';
  for (const p of PROVINCES) {
    if (trimmedAddress.includes(p)) {
      province = p;
      break;
    }
  }

  // 如果没有找到完整省份名，尝试匹配简称
  if (!province) {
    const provinceShortMap: Record<string, string> = {
      北京: '北京市',
      天津: '天津市',
      上海: '上海市',
      重庆: '重庆市',
      河北: '河北省',
      山西: '山西省',
      辽宁: '辽宁省',
      吉林: '吉林省',
      黑龙江: '黑龙江省',
      江苏: '江苏省',
      浙江: '浙江省',
      安徽: '安徽省',
      福建: '福建省',
      江西: '江西省',
      山东: '山东省',
      河南: '河南省',
      湖北: '湖北省',
      湖南: '湖南省',
      广东: '广东省',
      海南: '海南省',
      四川: '四川省',
      贵州: '贵州省',
      云南: '云南省',
      陕西: '陕西省',
      甘肃: '甘肃省',
      青海: '青海省',
      台湾: '台湾省',
      内蒙古: '内蒙古自治区',
      广西: '广西壮族自治区',
      西藏: '西藏自治区',
      宁夏: '宁夏回族自治区',
      新疆: '新疆维吾尔自治区',
      香港: '香港特别行政区',
      澳门: '澳门特别行政区',
    };

    for (const [short, full] of Object.entries(provinceShortMap)) {
      if (trimmedAddress.includes(short)) {
        province = full;
        break;
      }
    }
  }

  if (!province) {
    return null;
  }

  // 2. 识别城市
  let city = '';
  const cities = CITY_MAP[province] || [];
  for (const c of cities) {
    if (trimmedAddress.includes(c)) {
      city = c;
      break;
    }
  }

  // 3. 识别区县（简化处理：找"区"、"县"、"市"）
  let district = '';
  const districtPatterns = /([^省市县]+?[区县镇])/g;
  const matches = trimmedAddress.match(districtPatterns);
  if (matches && matches.length > 0) {
    // 过滤掉省份和城市
    for (const match of matches) {
      const cleanMatch = match.trim();
      if (
        cleanMatch &&
        !province.includes(cleanMatch) &&
        !city.includes(cleanMatch)
      ) {
        district = cleanMatch;
        break;
      }
    }
  }

  // 4. 提取详细地址
  let detail = trimmedAddress;
  if (province) detail = detail.replace(province, '');
  if (city) detail = detail.replace(city, '');
  if (district) detail = detail.replace(district, '');
  detail = detail.trim();

  return {
    province,
    city: city || '',
    district: district || '',
    detail,
  };
}
