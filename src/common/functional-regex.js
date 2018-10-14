/**
 * Simple thing to make js regex feel a bit more functional.
 * For example:
 * const regex = new Fregex();
 * regex.forEach(/[a-z]/gi, msg, (m) => { // handle result });
 */
class Fregex {
    forEach(regex, text, fn) {
        let i = 0;
        let m;
        while ((m = regex.exec(text)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            fn(m, i);
            i += 1;
        }
    }
}

module.exports = Fregex;
