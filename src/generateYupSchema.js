import * as t from "@babel/types";
import generate from "@babel/generator";
import { parse } from "@babel/parser";
import { YUP_TYPE_LIST, SUGAR_VARIABLES } from "./constants";
import { isNotEmptyArray } from "./lib/asserts";
import { JsonMockDescription } from "./JsonMockDescription";
import prepareGenerateYupSchema from "./prepareGenerateYupSchema";
/**
 * 检查指令是否支持
 */
const isSupported = (d) => YUP_TYPE_LIST.includes(d);

/**
 * 生成 Yup 验证架构脚本
 * @param {JsonMockDescription} description 描述文档
 */
export default function (description) {
  return new Promise((resolve, reject) => {
    if (!(description instanceof JsonMockDescription)) {
      console.error("不能生成yup验证规则, 收到的参数不符合预期!");
      reject();
      return;
    }

    const code = `
  /**
   * @overview A Yup schema generated by tfc.
   */
  import { object, mixed, date, string, number, array } from "yup";

  export default object();
  `;

    const ast = parse(code, { sourceType: "module" });
    const objectDeclare = ast.program.body[1].declaration;

    const objectProperties = [];

    prepareGenerateYupSchema(description);

    for (const property of description.properties) {
      const rules = buildRulesChain(property);
      objectProperties.push(
        t.objectProperty(t.identifier(property.key), rules)
      );
    }
    objectDeclare.arguments.push(t.objectExpression(objectProperties));

    const output = generate(ast, {}, code);
    const text = ensureReadableText(output.code);

    resolve(text);
  });
}

/**
 * 构建规则链
 */
export function buildRulesChain(property) {
  if (isNotEmptyArray(property.annotations)) {
    return makeRuleExpression(property.annotations, 0);
  }

  console.warn("无法构建规则, property 参数是空的!");
}

function makeRuleExpression(annotations, index) {
  if (annotations.length === 1 || index === annotations.length - 1) {
    const ann = annotations[index];

    return t.callExpression(t.identifier(ann.method), makeRuleArguments(ann));
  }

  const ann = annotations[index];
  return t.callExpression(
    t.memberExpression(
      makeRuleExpression(annotations, index + 1),
      t.identifier(ann.method)
    ),
    makeRuleArguments(annotations[index])
  );
}
/**
 * 构建规则参数
 */
function makeRuleArguments(annotation) {
  function cast(value) {
    const type = typeof value;
    switch (type) {
      case "string":
        return t.stringLiteral(value);
      case "number":
        return t.numericLiteral(value);
      case "boolean":
        return t.booleanLiteral(value);
      default:
        return t.stringLiteral(value);
    }
  }

  return annotation.parameters.map(cast);
}

/**
 * 将unicode字符转化成可读的汉字
 * @param {*} unicodeText
 */
function ensureReadableText(unicodeText) {
  const r = /\\u([\d\w]{4})/gi;
  const dest = unicodeText.replace(r, function (match, grp) {
    return String.fromCharCode(parseInt(grp, 16));
  });
  return decodeURIComponent(dest);
}
