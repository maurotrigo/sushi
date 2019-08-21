import FormulaValues from 'formula-values';

import Tools from './Tools';

const deepNavigate = (obj = {}, callback = () => {}, path = []) => {
	let pathCopy = path.slice();
	for (let property in obj) {
		pathCopy.push(property);

		if (Tools.isObject(obj[property])) {
			deepNavigate(obj[property], callback, pathCopy);
		} else {
			callback(obj, obj[property], pathCopy);
		}
	}
};

const parsePath = (pathParam) => {
	return !Tools.isArray(pathParam) ? [pathParam] : pathParam;
};

const GET_MATCH_REGEX = new RegExp('(.+)\\[([0-9]*)\\]');

const get = (obj, path, defaultValue) => {
	if (path === '') {
		return obj;
	}

	var arr = path.split('.'),
		comp,
		match;

	while (arr.length && obj) {
		comp = arr.shift();
		match = GET_MATCH_REGEX.exec(comp);

		if ((match !== null) && (match.length === 3)) {
			var arrayData = { arrName: match[1], arrIndex: match[2] };
			if (obj[arrayData.arrName] !== undefined) {
				obj = obj[arrayData.arrName][arrayData.arrIndex];
			} else {
				obj = undefined;
			}
		} else {
			if (isNaN(comp)) {
				obj = obj[comp];
			} else {
				obj = obj[('undefined' === typeof obj[comp] ? Number(comp) : comp)];
			}
		}
	}

	return ('undefined' === typeof obj) ? defaultValue : obj;
};

/**
 * @todo Enable same path options as get().
 */
const set = (obj, path, value) => {

	path = path.split('.');

	var nested = obj,
		key,
		index = -1,
		size = path.length,
		lastIndex = size - 1;

	while (nested !== null && ++index < size) {

		key = path[index];

		if (index === lastIndex) {
			nested[key] = value;
		} else {
			nested[key] = typeof nested[key] !== 'undefined' ? nested[key] : {};
		}

		nested = nested[key];
	}

	return obj;
};

const remove = (obj, path) => {

	path = path.split('.');

	var nested = obj,
		key,
		index = -1,
		size = path.length,
		lastIndex = size - 1;

	while (nested !== null && ++index < size) {
		key = path[index];

		if (index === lastIndex) {
			delete nested[key];
		} else if (typeof nested[key] !== 'undefined') {
			nested = nested[key];
		} else {
			break;
		}
	}

	return obj;
};

const extractMap = (item, paths, defaultValue) => {
	return parsePath(paths).map((path) => {
		return get(item, path, defaultValue);
	});
};

const iterateMap = (item, paths, defaultValue, callback) => {
	parsePath(paths).forEach((path) => {
		callback(path, get(item, path, defaultValue));
	});
};

const wildcardSeparator = '*';

const evalKeys = (keys, value) => {

	if (!keys) {
		return true;
	}

	keys = Tools.isArray(keys) ? keys : [keys];

	return keys.reduce((previousValidation, key) => {
		let result = false;
		let firstWildcard = key.indexOf(wildcardSeparator);

		if (firstWildcard !== -1) {

			let lastWildcard = key.lastIndexOf(wildcardSeparator);

			if (lastWildcard !== -1 && firstWildcard !== lastWildcard) {
				result = value.includes(key.substring(firstWildcard + 1, lastWildcard));
			} else if (firstWildcard === 0) {
				result = value.endsWith(key.substr(1));
			} else if (firstWildcard === (key.length - 1)) {
				result = value.startsWith(key.slice(0, -1));
			}
		} else {
			result = value === key;
		}

		return previousValidation || result;
	}, false);

};

const extractKeys = (item, operationKeys) => {
	return Object.keys(item).filter((key) => {
		return evalKeys(operationKeys, key);
	});
};

const extractKeyValues = (item, operationKeys) => {
	return extractKeys(item, operationKeys).map((key) => {
		return item[key];
	});
};

const getKeys = (item, operationKeys) => {
	return Object.keys(item).filter((key) => {
		return evalKeys(operationKeys, key);
	});
};

const iterateKeys = (item, operationKeys, callback) => {
	Object.keys(item).forEach((key) => {
		if (evalKeys(operationKeys, key)) {
			callback(key);
		}
	});
};

const evalValue = (value, subject) => {

	if (Tools.isArray(subject) || Tools.isObject(subject)) {
		return false;
	}

	if (value.charAt(0) === '!') {
		return !subject.includes(value.substr(1));
	} else {
		return subject.includes(value);
	}
};

const evalValues = (values, subject) => {
	return values.reduce((previousValidation, value) => {
		return previousValidation || evalValue(value, subject);
	}, false);
};

const compare = (lvalue, rvalue, operator) => {

	operator = operator || 'eq';

	let operators = {
		'eq': (l, r) => { return l === r; },
		'ne': (l, r) => { return l !== r; },
		'lt': (l, r) => { return l < r; },
		'gt': (l, r) => { return l > r; },
		'le': (l, r) => { return l <= r; },
		'ge': (l, r) => { return l >= r; },
	};

	return operators[operator] ? operators[operator](lvalue, rvalue) : null;
};

const calculate = (operands, operator) => {

	operator = operator || 'addition';

	const operators = {
		'addition': {
			method: (lvalue, rvalue) => {
				return lvalue + rvalue;
			},
			neutral: 0
		},
		'subtraction': {
			method: (lvalue, rvalue) => {
				return lvalue - rvalue;
			},
			neutral: 0
		},
		'division': {
			method: (lvalue, rvalue) => {
				return lvalue / rvalue;
			},
			neutral: 1
		},
		'multiplication': {
			method: (lvalue, rvalue) => {
				return lvalue * rvalue;
			},
			neutral: 1
		},
	};

	return operands.reduce((memo, value) => {
		value = value === null || value === undefined ? 0 : value;
		return operators[operator].method(
			parseFloat(value) || operators[operator].neutral,
			memo
		);
	}, operators[operator].neutral);
};

const average = (values) => {

	values = values.filter((value) => {
		return value !== null && value !== undefined;
	});

	if (values.length === 0) {
		return 0;
	}

	return calculate(
		values,
		'addition'
	) / values.length;
};

const compareString = (lvalue, rvalue, operator) => {

	operator = operator || 'eq';

	let operators = {
		'eq': (l, r) => { return l === r; },
		'ne': (l, r) => { return l !== r; },
		'includes': (l, r) => { return l.includes(r); },
		'startsWith': (l, r) => { return l.startsWith(r); },
		'endsWith': (l, r) => { return l.endsWith(r); },
	};

	return operators[operator](lvalue, rvalue);
};

let fvCache = {};
const evalFV = (expression, context) => {
	if (!fvCache[expression]) {
		fvCache[expression] = new FormulaValues(expression);
	}

	let fv = fvCache[expression];
	return fv.eval(context);
};

const evalTemplate = (template, context) => {

	if (!template) {
		return {};
	}

	if (template !== Object(template)) {
		return evalFV(template, context);
	}

	let evaluatedTemplate = Array.isArray(template) ? template.slice() : Object.assign({}, template),
		value,
		evaluatedProperty;

	for (let property in evaluatedTemplate) {
		evaluatedProperty = evalFV(property, context);
		value = evaluatedTemplate[property];

		if (value === Object(value)) {
			evaluatedTemplate[evaluatedProperty] = evalTemplate(value, context);
		} else {
			evaluatedTemplate[evaluatedProperty] = evalFV(value, context);
		}

		if (evaluatedProperty !== property) {
			delete evaluatedTemplate[property];
		}
	}

	return evaluatedTemplate;
};

export default {
	get: get,
	set: set,
	remove: remove,
	extractMap: extractMap,
	iterateMap: iterateMap,
	extractKeys: extractKeys,
	extractKeyValues: extractKeyValues,
	getKeys: getKeys,
	iterateKeys: iterateKeys,
	evalValues: evalValues,
	compare: compare,
	calculate: calculate,
	average: average,
	compareString: compareString,
	evalFV: evalFV,
	evalTemplate: evalTemplate,
	deepNavigate: deepNavigate
};
