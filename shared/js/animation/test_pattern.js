import { AnimationBase } from '../animation_base.js';

export default class TestPattern extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Verification Pattern",
            ja: "動作確認用パターン",
            de: "Verifizierungsmuster",
            es: "Patrón de verificación",
            fr: "Motif de vérification",
            pt: "Padrão de verificação",
            ko: "동작 확인용 패턴",
            zh: "验证模式"
        },
        description: {
            en: "A high-visibility static pattern for bit-perfect visual verification. (Excluded from release)",
            ja: "ビット単位での完全一致を確認するための、視認性の高い完全に静止したパターンです。（製品版には含まれません）",
            de: "Ein hochsichtbares statisches Muster für eine bitgenaue visuelle Verifizierung. (Nicht im Release enthalten)",
            es: "Un patrón estático de alta visibilidad para una verificación visual perfecta. (Excluido del lanzamiento)",
            fr: "Un motif statique à haute visibilité pour une vérification visuelle parfaite bit à bit. (Exclu de la version finale)",
            pt: "Um padrão estático de alta visibilidade para verificação visual perfecta bit a bit. (Excluído do lançamento)",
            ko: "비트 단위의 완전 일치를 확인하기 위한, 시인성이 높은 완전히 정지된 패턴입니다. (릴리스 제외)",
            zh: "用于位对位完全一致验证的高可见性静态模式。（不包含在发布版本中）"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'freedom' };

    constructor() {
        super();
        this.dots = [];
    }

    setup(width, height) {
        this.dots = [];
        const step = 6;
        const thickness = 2; // Thickness in cells

        for (let x = 0; x <= width; x += step) {
            for (let y = 0; y <= height; y += step) {
                const col = x / step;
                const row = y / step;
                const maxCol = Math.floor(width / step);
                const maxRow = Math.floor(height / step);

                // 1. Thick border (outermost 2 cells)
                const isBorder = col < thickness || row < thickness ||
                                 col > maxCol - thickness || row > maxRow - thickness;

                // 2. Large thick central cross
                const centerX = Math.floor(maxCol / 2);
                const centerY = Math.floor(maxRow / 2);
                const isCross = Math.abs(col - centerX) < thickness ||
                                Math.abs(row - centerY) < thickness;

                // 3. Corner markers (larger dots)
                const isCorner = (col < thickness && row < thickness) ||
                                 (col > maxCol - thickness && row < thickness) ||
                                 (col < thickness && row > maxRow - thickness) ||
                                 (col > maxCol - thickness && row > maxRow - thickness);

                if (isBorder || isCross || isCorner) {
                    this.dots.push({ x, y, size: 3 });
                }
            }
        }
    }

    draw() {
        return this.dots;
    }
}
