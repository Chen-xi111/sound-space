# 工程音频素材说明

`diagnostic-tone.wav` 为本项目于 2026-10-06 使用数学公式自行生成的测试音：24 kHz、16-bit PCM、单声道、两秒，330 Hz 正弦载波，头尾短淡入淡出。

它用于校验文件加载、声道、解码、循环、交叉淡化和完成提示。不包含第三方录音，不是自然声、音乐作品或研究干预方案。

实际 SHA-256、时长和资源映射保存在 `src/audio/catalog.js`。改变文件内容时必须同步更新目录版本、哈希及相关测试。

## 自然录音 · 2026-10-09 接入

以下是真实录音的处理片段，不是合成噪声模拟。页面作者、许可和原始文件均于 2026-10-09 核对。应用内 `#/credits` 保留署名、许可链接及修改说明，不表示原作者认可或参与本平台。

| 应用文件 | 原作与作者 | 许可 | 修改 |
|---|---|---|---|
| nature-rain-v1.wav | [Rain](https://commons.wikimedia.org/wiki/File:Rain_(1).ogg) · ezwa | 作者释放到公有领域（PD-author） | 第 5—35 秒 |
| nature-stream-v1.wav | [Swale](https://commons.wikimedia.org/wiki/File:Swale.ogg) · Siddharth Patil（Ksd5 / Sidpatil） | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 第 1—29 秒 |
| nature-wind-v1.wav | [Wind in sparren in het Vijlenerbos](https://commons.wikimedia.org/wiki/File:Wind_in_sparren_in_het_Vijlenerbos_-_SoundCloud_-_luc_de_bruijn.ogg) · luc de bruijn | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 第 60—105 秒 |

原始下载：

- https://upload.wikimedia.org/wikipedia/commons/0/0e/Rain_%281%29.ogg
- https://upload.wikimedia.org/wikipedia/commons/8/84/Swale.ogg
- https://upload.wikimedia.org/wikipedia/commons/9/9c/Wind_in_sparren_in_het_Vijlenerbos_-_SoundCloud_-_luc_de_bruijn.ogg

处理过程：截取、24 kHz 重采样、去除直流偏置、统一 RMS 目标增益、tanh 柔化瞬态峰值、16-bit PCM 编码。保留雨声与溪流单声道、风声双声道。三段合计 7,104,132 字节，均随应用本地提供，不在运行时连接外站。循环使用 1.8 秒交叉淡化；它属于播放设置而非直接写入素材。

原始文件与交付文件 SHA-256、实际 RMS、峰值和时长见 [nature-manifest.json](nature-manifest.json)。复现脚本为 `scripts/prepare-nature.py`，仅开发处理需要 Python/numpy/soundfile 与 macOS afconvert，应用仍无第三方运行依赖。未来替换处理片段必须增加素材版本，不能直接覆盖已有版本。

风声片段及其处理版本按 CC BY 3.0 提供；分发时保留作者、原作链接、许可及修改说明。其他录音的公有领域状态不影响应用代码自身的权利。

## 连续融合载体 · 2026-10-10

`carrier-soft-rain-v1.wav` 来自上述 ezwa 的 Rain 片段（公有领域）
`carrier-water-veil-v1.wav` 来自上述 Siddharth Patil 的 Swale 片段（CC0 1.0）

这两段属于经过声音设计的录音衍生素材，不是新增实地录音，也不称水幕为瀑布现场录音。作者、来源与许可沿用原作，在应用 `#/credits` 单独列出。

处理：宽频段 EQ 匹配粉红背景的参考频谱（载体 EQ 最多 ±9 dB）、两秒纹理片段交叠、慢速能量平整、独立双声道重构、柔化瞬态。45 秒主体后附与开头逐样本相同的 1.8 秒交叉淡化尾段，交付时长 46.8 秒；双声道 24 kHz 16-bit PCM。循环时避免线性交叉淡化将不相关信号混合而造成音量凹陷。独立实时噪声生成器没有接受上述 EQ 或峰值处理。

生成流程与质量记录：

1. `node scripts/render-carrier-reference.mjs`
2. `python3 scripts/prepare-carriers.py`（开发环境需要 numpy）
3. `node scripts/render-carrier-comparisons.mjs`

源文件哈希、交付哈希、EQ 参数、RMS、峰值与纹理种子见 `carrier-manifest.json`。原三段录音和哈希保持不变。对比小样由实际应用 DSP 导出；只对导出文件统一 RMS，应用内保留实际混音设置。
