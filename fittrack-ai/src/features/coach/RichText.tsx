import { Text, View } from 'react-native';
import { fonts, space, useTheme } from '../../ui/theme';

/** Renders the coach's plain text: paragraphs, "- " bullets and **bold**. Nothing else is interpreted. */
function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color }}>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
        ? <Text key={i} style={{ fontFamily: fonts.bodySemiBold }}>{p.slice(2, -2)}</Text>
        : <Text key={i}>{p}</Text>))}
    </Text>
  );
}

export function RichText({ text, color }: { text: string; color?: string }) {
  const { c } = useTheme();
  const fg = color ?? c.text;
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <View style={{ gap: space.sm }}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        return (
          <View key={bi} style={{ gap: 6 }}>
            {lines.map((line, li) => {
              const bullet = /^\s*([-*•]|\d+\.)\s+/.exec(line);
              return bullet
                ? (
                  <View key={li} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 8 }} />
                    <View style={{ flex: 1 }}><Inline text={line.slice(bullet[0].length)} color={fg} /></View>
                  </View>
                )
                : <Inline key={li} text={line.replace(/^#+\s*/, '')} color={fg} />;
            })}
          </View>
        );
      })}
    </View>
  );
}
