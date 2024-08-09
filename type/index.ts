import { Answers } from 'inquirer';
// input options 配置选项。用于输入框和options的配置
export type Input = {
  name: string;
  value: boolean | string;
  options?: any; // 额外的配置项
};

// 数据对象
export type Data = {
  name: string;
  value: string;
};

export type Choices = Data[] | string[];

export type Condition = (answers: Answers) => boolean;

// 自动生成单选框和多选框的类型定义
export type GenerateSelectType = (
  name: string,
) => (message: string) => (choices: Choices, condition?: Condition) => any;

// 自动生成输入框的类型定义
export type GenerateInputType = (name: string) => (message: string, condition?: Condition) => any;

// lib/util 类型定义
export type WhenFun = (map: Record<string, string | string[]>) => (answers: Answers) => boolean;

// 确认框类型定义
export type GenerateConfirmType = (name: string) => (message: string, condition?: Condition) => any;
