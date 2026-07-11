# Chainlit 智能体 Demo

基于 Chainlit 的智能体外壳，接入腾讯混元 (Hy3) 大模型。

## 🚀 快速开始

```bash
# 安装依赖
uv sync

# 启动应用
uv run poe start
```

访问 http://localhost:8000

## 📝 添加 MCP 工具

参考 `app.py` 中的注释说明，4 步即可添加工具调用功能。

## 🔧 配置

- **模型**: 腾讯混元 Hy3 (via ModelScope)
- **端口**: 8000 (Chainlit 默认)
- **热重载**: 开发模式已启用 (`-w`)

## ColorBridge MVP 时序图

```mermaid
sequenceDiagram
    autonumber

    actor O as 路演操作员
    participant UI as Next.js 单页工作台
    participant State as Demo 状态机
    participant DB as Prisma + SQLite
    participant Seed as 种子数据 / 缓存 JSON
    participant AI as AI 分析服务
    participant CL as Chainlit app.py
    participant LLM as ModelScope Hy3
    participant Match as 历史案例匹配
    participant Delta as Delta E 计算
    participant Report as 报告预览

    Note over UI: 第一屏直接进入工作台<br/>顶部状态 + 左侧 6 步 + 中间主操作 + 右侧极简摘要

    O->>UI: 点击「载入演示案例」
    UI->>State: 初始化或重置 Demo 流程
    State->>DB: 查找当前 Demo 订单

    alt 数据库已有 Demo 订单
        DB-->>State: 返回订单与已有状态
    else 数据库为空
        State->>Seed: 读取主演示句子与种子数据
        Seed-->>State: 返回客户原文、历史案例、打样结果
        State->>DB: 写入 ColorOrder / HistoricalCase / TraceEvent
        DB-->>State: 返回新 Demo 订单
    end

    State-->>UI: 展示步骤 1「载入客户聊天」
    UI-->>O: 显示客户原文<br/>“高级一点的雾霾蓝，别太紫，像上次那块，做在棉针织上。”

    O->>UI: 点击「运行 AI 分析」
    UI->>State: 进入步骤 2
    State->>AI: 请求结构化分析

    alt 主 Demo 稳定路径
        AI->>Seed: 读取缓存分析 JSON
        Seed-->>AI: 返回确定性结构化结果
    else 实时 AI 可用
        AI->>LLM: 调用模型生成结构化 JSON
        LLM-->>AI: 返回 AI 分析结果
    else 实时 AI 失败或超时
        AI->>Seed: 回退读取缓存分析 JSON
        Seed-->>AI: 返回缓存结果
    end

    AI-->>State: 返回 AnalysisResult<br/>颜色意图、风险、面料、缺失字段、置信度、追问问题
    State->>DB: 保存 AnalysisResult 和 TraceEvent
    DB-->>State: 保存成功
    State-->>UI: 展示步骤 2「AI 分析」

    opt Chainlit 调试 / 备用演示入口
        O->>CL: 打开 Chainlit app.py
        CL->>LLM: 使用 Hy3 调试提示词或备用对话
        LLM-->>CL: 返回模型响应
        CL-->>O: 展示调试结果
        Note over CL,UI: Chainlit 不作为主工作台<br/>不阻塞 Next.js MVP 主流程
    end

    O->>UI: 填写或确认缺失字段
    UI->>State: 提交人工确认字段
    State->>DB: 更新 ColorOrder 确认字段<br/>光源 D65、基布、目标 Lab、Delta E 阈值
    DB-->>State: 保存成功
    State-->>UI: 展示步骤 3「人工确认字段」

    O->>UI: 点击「检索历史案例」
    UI->>State: 进入步骤 4
    State->>Match: 请求相似历史案例

    Match->>DB: 读取 HistoricalCase 种子案例
    DB-->>Match: 返回 3 条历史案例
    Match-->>State: 返回确定性匹配结果<br/>案例名称、面料基布、Lab、相似原因、风险提示
    State->>DB: 保存匹配结果和 TraceEvent
    DB-->>State: 保存成功
    State-->>UI: 展示步骤 4「历史案例」

    O->>UI: 选择参考案例
    UI->>State: 保存选中案例
    State->>DB: 更新订单参考案例
    DB-->>State: 保存成功

    O->>UI: 点击「对比打样结果」
    UI->>State: 进入步骤 5
    State->>DB: 读取目标 Lab、阈值、内置打样版本
    DB-->>State: 返回 SampleAttempt 数据

    State->>Delta: 计算或读取 Delta E
    Delta-->>State: 返回 V1 / V2 对比结果

    alt 第一次打样
        State-->>UI: 展示 V1<br/>Delta E 超阈值，不合格，说明偏差方向
    end

    alt 第二次打样
        State-->>UI: 展示 V2<br/>Delta E 达标
    end

    State->>DB: 保存 SampleAttempt 和 TraceEvent
    DB-->>State: 保存成功

    O->>UI: 点击「采用达标样版」
    UI->>State: 锁定达标样版 V2
    State->>DB: 更新订单最终样版
    DB-->>State: 保存成功

    O->>UI: 点击「生成确认卡」
    UI->>State: 进入步骤 6
    State->>DB: 汇总订单、分析、确认字段、参考案例、打样版本、追溯事件
    DB-->>State: 返回完整追溯数据

    State->>Report: 生成报告预览数据
    Report-->>State: 返回客户确认卡和版本时间线

    State-->>UI: 展示步骤 6「确认与追溯」
    UI-->>O: 显示已确认色彩需求、光源、Delta E 阈值、参考案例、达标样版、追溯事件

    opt 重置 Demo
        O->>UI: 点击「重置 Demo」
        UI->>State: 清空当前演示状态
        State->>DB: 重置 Demo 订单或重新载入种子数据
        DB-->>State: 返回初始状态
        State-->>UI: 回到步骤 1
    end
```
