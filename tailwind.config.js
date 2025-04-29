/** @type {import('tailwindcss').Config} */
module.exports = {
	important: true,
	content: [
		"**/*.{html, scss, ts}",
		"**/*.ts",
		"**/*.html",
	],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				primary: '#7e22ce',
				secondary: "#080808",
				outlineColor: "#1F2123"
			}
		},
	},
	plugins: [
    require('flyonui'),
    require('flyonui/plugin')
],
}
