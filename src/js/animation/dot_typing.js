import { AnimationBase } from '../animation_base.js';

/**
 * DotTyping Animation
 * Retro terminal-style animation with characters being typed and erased.
 * レトロなターミナル風の、文字がタイピングされたり消されたりするアニメーションです。
 */
export default class DotTyping extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Dot Typing",
            ja: "ドット・タイピング",
            de: "Punkt-Tippen",
            es: "Mecanografía de puntos",
            fr: "Saisie de points",
            pt: "Digitação de pontos",
            ko: "도트 타이ピング",
            zh: "点打字"
        },
        description: {
            en: "Retro terminal-style animation with characters being typed and occasionally backspaced.",
            ja: "レトロなターミナル風の、文字がタイピングされ、時々バックスペースで消されるアニメーションです。",
            de: "Retro-Terminal-Animation, bei der Zeichen getippt und gelegentlich gelöscht werden.",
            es: "Animación retro estilo terminal con caracteres que se escriben y ocasionalmente se borran.",
            fr: "Animation de style terminal rétro avec des caractères saisis et parfois effacés.",
            pt: "Animação retrô estilo terminal com caracteres sendo digitados e ocasionalmente apagados.",
            ko: "복고풍 터미널 스타일의 애니메이션으로, 문자가 입력되고 때때로 백ス페이스로 지워집니다。",
            zh: "复古终端风格动画，字符被输入，偶尔会被退格删除。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    constructor() {
        super();
        this.rows = 5;
        this.cols = 15;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0, progress = 0 } = {}) {
        const sprites = [];
        const totalChars = this.rows * this.cols;

        // Calculate number of characters to show based on progress
        // 進捗に基づいて表示する文字数を計算
        const targetChars = Math.floor(progress * totalChars);

        // Build a buffer representing typed characters (with occasional backspacing)
        // タイピングされた文字のバッファを作成（時々バックスペースを入れる演出）
        const buffer = [];
        for (let i = 0; i < targetChars; i++) {
            if (i % 15 === 14) {
               // Retro effect: delete last 3 characters
               // レトロな演出：最後の3文字を削除
               buffer.splice(-3);
            } else {
               buffer.push(i);
            }
        }

        // Draw each character in the buffer
        // バッファ内の各文字を描画
        buffer.forEach((_, i) => {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const x = 20 + c * 15;
            const y = 30 + r * 15;

            // Character represented by 2 dots
            // 文字を2つのドットで表現
            sprites.push({ x, y, size: 2 });
            sprites.push({ x: x + 2, y: y + 2, size: 1 });
        });

        // Draw blinking cursor
        // 点滅するカーソルの描画
        if (Math.floor(elapsedMs / 500) % 2 === 0) {
            const lastIdx = buffer.length;
            const r = Math.floor(lastIdx / this.cols);
            const c = lastIdx % this.cols;
            const x = 20 + c * 15;
            const y = 30 + r * 15;

            // Cursor as a large dot
            // カーソルを大きなドットで表現
            sprites.push({ x, y: y - 5, size: 3 });
        }

        return sprites;
    }
}
