export function brandColors(value: string) {
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(value) ? value : '#16342b';
  const rgb = [1, 3, 5]
    .map((i) => parseInt(backgroundColor.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return { backgroundColor, color: luminance > 0.179 ? '#000000' : '#ffffff' };
}
