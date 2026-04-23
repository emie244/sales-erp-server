import { Cascader } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import regionJson from 'china-area-data/data.json';

// 转换 china-area-data 格式为 Cascader 需要的格式
function convertRegionData(): DefaultOptionType[] {
  const data = regionJson as Record<string, Record<string, string>>;
  const result: DefaultOptionType[] = [];

  // 获取省份列表 (key "86")
  const provinces = data['86'] || {};

  for (const [provinceCode, provinceName] of Object.entries(provinces)) {
    const provinceNode: DefaultOptionType = {
      value: provinceName,
      label: provinceName,
      children: [],
    };

    // 获取城市列表
    const cities = data[provinceCode] || {};

    for (const [cityCode, cityName] of Object.entries(cities)) {
      // 跳过 "市辖区" 这种通用名称，直接用区级
      if (cityName === '市辖区' || cityName === '县') {
        const districts = data[cityCode] || {};
        for (const districtName of Object.values(districts)) {
          provinceNode.children = provinceNode.children || [];
          provinceNode.children.push({
            value: districtName,
            label: districtName,
          });
        }
        continue;
      }

      const cityNode: DefaultOptionType = {
        value: cityName,
        label: cityName,
        children: [],
      };

      // 获取区县列表
      const districts = data[cityCode] || {};

      for (const districtName of Object.values(districts)) {
        cityNode.children = cityNode.children || [];
        cityNode.children.push({
          value: districtName,
          label: districtName,
        });
      }

      provinceNode.children = provinceNode.children || [];
      provinceNode.children.push(cityNode);
    }

    result.push(provinceNode);
  }

  return result;
}

const regionData: DefaultOptionType[] = convertRegionData();

interface Props {
  value?: string[];
  onChange?: (value: (string | number | null)[]) => void;
  placeholder?: string;
}

export default function RegionCascader({
  value,
  onChange,
  placeholder,
}: Props) {
  return (
    <Cascader
      options={regionData}
      value={value}
      onChange={onChange}
      placeholder={placeholder || '请选择省/市/区'}
      style={{ width: '100%' }}
    />
  );
}
