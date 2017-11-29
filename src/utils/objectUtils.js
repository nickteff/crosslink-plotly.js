import {__, all, apply, keys, max, prop, reduce, zip} from 'ramda';

export const isPlainObject = require('is-plain-object');

const strictEqual = (a, b) => a === b;

/**
 * Mutate arrays by enforcing that all of them have the same `length` attribute.
 * @param {Array} data An array of possibly unequal-length arrays.
 * @returns {Array} Returns the data array for chaining.
 */
export function align(data) {
    const maxLength = reduce(max, 0, data.map(array => array.length));
    for (let i = 0; i < data.length; i++) {
        data[i].length = maxLength;
    }
    return data;
}

/**
 * Roughly based on react-redux/src/utils/shallowEqual.js
 * @param {Object} a The first object.
 * @param {Object} b The second object.
 * @returns {Boolean} True if all *top-level* values are strictly equal.
 */
export function shallowEqual(a, b) {
    if (strictEqual(a, b)) {
        return true;
    }
    const keysA = keys(a);
    const pairs = zip(keysA.map(prop(__, a)), keysA.map(prop(__, b)));
    return keysA.length === keys(b).length && all(apply(strictEqual), pairs);
}


/*
 * Helper function for _walkObject
 */
function doArrayWalk(key, value, walkArrays, walkArraysMatchingKeys) {

    if (!Array.isArray(value)) {
        return false;
    }

    if (walkArrays ||
        (walkArraysMatchingKeys && walkArraysMatchingKeys.includes(key))) {
        return true;
    }

    return false;
}

/*
 * Helper utility for path accumulation in _walkObject. Supports array
 * path accumulation and also Plotly.js nestedProperty style.
 */
function getPath(pathType = 'array', _path) {
    return {
        _path: _path || (pathType === 'array' ? [] : ''),
        set(parent, key) {
            let nextPath;
            switch (pathType) {
                case 'array':
                    nextPath = this._path.concat([key]);
                    break;

                case 'nestedProperty':
                    if (this._path.length === 0) {
                        nextPath = key;
                    }
                    else if (Array.isArray(parent)) {
                        nextPath = this._path + `[${key}]`;
                    } else {
                        nextPath = this._path + '.' + key;
                    }
                    break;

                default:
                    throw new Error('unrecognized pathType ' + pathType);
            }

            return getPath(pathType, nextPath);
        },

        get(parent, key) {

            // in array mode we do not return the leaf node key.
            if (pathType === 'array') {
                return this._path;
            }

            // in nestedProperty mode we return full path including final key
            return this.set(parent, key)._path;
        }
    };
}

/*
 * Helper function that transforms an array of path parts into a single path.
 * For example:
 *
 *  ['_fullData', 0, 'transforms', 3, 'type'] => 'transforms[3].type'
 *
 * Note that it strips out the _fullData part (and also _fullInput) since that's
 * usually present in the attribute path but isn't necessary in the attribute
 * string since it's usually implicitly applied through the userDataIndex.
 */
export function makeAttrSetterPath(parts) {
    let path = '';

    // Truncate the leading parts that aren't intersting when applying changes:
    let i0 = 0;
    if (parts[i0] === '_fullData') {i0 += 2;}
    if (parts[i0] === '_fullInput') {i0++;}
    if (parts[i0] === '_fullLayout') {i0++;}

    for (let i = i0; i < parts.length; i++) {
        if (typeof parts[i] === 'number' || Array.isArray(parts[i])) {
            path += '[' + (Array.isArray(parts[i]) ? parts[i][0] : parts[i]) + ']';
        } else {
            path += (i > i0 ? '.' : '') + parts[i];
        }
    }
    return path;
}



/**
 * The function that walkObject calls at each node.
 *
 * @callback walkObjectCallback
 * @param {string|number} key The current key, which may be nested.
 * @param {object} parent The object which owns the 'key' as a prop.
 * @param {Array} path The keys that lead to the 'parent' object.
 * @returns {boolean} True if the value at 'key' should *not* be traversed into
 *                    if it happens to be an object. I.e., you don't need to
 *                    return anything if you want the default traversal of the
 *                    whole object.
 */

/**
 * Walks through object and recurses if necessary.
 *
 * @param {object} object The top-level or nested object we're walking through.
 * @param {walkObjectCallback} callback Called at each object node.
 * @param {Array} path The keys that lead from to top-level object to this one.
 * @param {object} config configuration object
 * @param {string} config.walkArrays flag allowing array walking
 * @param {Array} config.walkArraysMatchingKeys An array of keys permitting
 *                                              array walking
 * @param {string} config.pathType Either 'array' or 'nestedProperty'. Array
 *                                 based paths return string keys in an array up
 *                                 until the current key position.
 *                                 NestedProperty style returns a single
 *                                 concatenated "nestedProperty" style string.
 * @returns {void}
 * @private
 */
function _walkObject(object, callback, path, config) {
    const {walkArrays, walkArraysMatchingKeys} = config;
    Object.keys(object).forEach(key => {

        // Callback can force traversal to stop by returning `true`.
        if (callback(key, object, path.get(object, key))) {
            return;
        }

        const value = object[key];
        if (isPlainObject(value) ||
            doArrayWalk(key, value, walkArrays, walkArraysMatchingKeys)) {

            _walkObject(value, callback, path.set(object, key), config);
        }
    });
}

/**
 * General function to walk object and call the given callback for each node.
 *
 * @param {Object|Array} input The object or array we want to walk.
 * @param {walkObjectCallback} callback Called at each object node.
 * @param {Object} [config] configuration object
 * @param {Boolean} [config.walkArrays] flag allowing array walking
 * @param {Array} [config.walkArraysMatchingKeys] An array of keys permitting
 *                                              array walking
 * @param {String} [config.pathType] Either 'array' or 'nestedProperty'. Array
 *                                   based paths return string keys in an array
 *                                   up until the current key position.
 *                                   NestedProperty style returns a single
 *                                   concatenated "nestedProperty" style string
 *                                   with the current key included in the path.
 *                                   Defaults to "array"
 * @returns {void}
 */
export function walkObject(input, callback, config = {}) {
    if (!isPlainObject(input) && !Array.isArray(input)) {
        throw new Error('The input must be an object.');
    }
    var path = getPath(config.pathType);
    _walkObject(input, callback, path, config);
}

/**
 * The function that copyObject calls at each node.
 *
 * @callback copyObjectCallback
 * @param {String|number} key The current key, which may be nested.
 * @param {Object} parent The object which owns the 'key' as a prop.
 * @param {Array} path The keys that lead to the 'parent' object.
 * @returns {Boolean} True if the value at 'key' should *not* be traversed into
 *                    if it happens to be an object. I.e., you don't need to
 *                    return anything if you want the default traversal of the
 *                    whole object.
 */

/**
 * General function to copy an object ({} || []).
 * @param {Object} input The value to copy.
 * @param {copyObjectCallback} callback If this returns `false`, don't copy.
 * @returns {Object} A copy of the input.
 */
export function copyObject(input, callback) {
    const output = Array.isArray(input) ? [] : {};

    // inputObjects are related to outputObjects via index.
    const inputObjects = [input];
    const outputObjects = [output];

    // Wrap the given callback to a more general `walkObject` callback.
    function walkCallback(key, inputParent, path) {
        // The caller can prevent copying portions of the input object.
        if (callback(key, inputParent, path) === false) {
            // This is awkward, it was a bad decision to return `true` to stop.
            return true;
        }

        const outputParent = outputObjects[inputObjects.indexOf(inputParent)];
        const inputValue = inputParent[key];
        const isObject = isPlainObject(inputValue);
        const isArray = isObject ? false : Array.isArray(inputValue);
        if (isObject || isArray) {
            // Keep track of this object. We'll need to access it as a parent.
            const outputValue = isArray ? [] : {};
            inputObjects.push(inputValue);
            outputObjects.push(outputValue);
            outputParent[key] = outputValue;
        } else {
            // Not something that needs sub-copying, just add it.
            outputParent[key] = inputValue;
        }

        // See _walkObject for the callback specification
        return false;
    }

    walkObject(input, walkCallback, {walkArrays: true});
    return output;
}
